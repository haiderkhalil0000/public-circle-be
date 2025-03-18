const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const { connectDbForThread, disconnectDbForThread } = require("./db-connection-thread");
const {
  webhooksController,
  companiesController,
  campaignsController,
  companyContactsController,
  stripeController,
} = require("../controllers");



const splitArrayIntoParts = (array, numberOfParts) => {
  const partSize = Math.ceil(array.length / numberOfParts);
  return Array.from({ length: numberOfParts }, (_, i) =>
    array.slice(i * partSize, (i + 1) * partSize)
  ).filter((part) => part.length);
};

const filterContacts = ({ contacts, criteria }) => {
  const criteriaMap = new Map(
    criteria.map((c) => [c.filterKey, new Set(c.filterValues)])
  );
  return contacts.filter((contact) =>
    [...criteriaMap].every(([key, values]) => values.has(contact[key]))
  );
};

const processCSVStream = (buffer) =>
  new Promise((resolve, reject) => {
    const contacts = [];
    Readable.from(Buffer.from(buffer, "base64"))
      .pipe(csvParser())
      .on("data", (data) => {
        if (Object.values(data).some((value) => value.trim())) {
          contacts.push(data);
        }
      })
      .on("end", () => resolve(contacts))
      .on("error", reject);
  });

const deduplicateContacts = (contacts, primaryKey) => {
  if (!contacts.length || !primaryKey || !(primaryKey in contacts[0])) {
    return contacts;
  }

  const seen = new Map();
  return contacts.filter((contact) => {
    const key = contact[primaryKey]?.toString().trim();
    if (!key || seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
};

const markDuplicateContacts = (contacts, existingContacts, primaryKey) => {
  const existingMap = new Map(
    existingContacts.map((c) => [c[primaryKey], c._id])
  );
  return contacts.map((contact) => {
    const existingId = existingMap.get(contact[primaryKey]);
    return existingId
      ? { ...contact, public_circles_existing_contactId: existingId }
      : contact;
  });
};

parentPort.on(
  "message",
  async ({ companyId, stripeCustomerId, contactsPrimaryKey, file }) => {
    try {
      const [
        company,
        existingCompanyContactsCount,
        existingCompanyContacts,
        duplicateContactsCount,
      ] = await Promise.all([
        companiesController.readCompanyById({ companyId }),
        companyContactsController.readCompanyContactsCount({ companyId }),
        companyContactsController.readAllCompanyContacts({ companyId }),
        companyContactsController.readDuplicateContactsCountByCompanyId({
          companyId,
        }),
        connectDbForThread(),
      ]);

      if (duplicateContactsCount) {
        throw new Error("Duplicates found in existing contacts");
      }

      let contacts = await processCSVStream(file.buffer);

      if (contactsPrimaryKey) {
        contacts = deduplicateContacts(contacts, contactsPrimaryKey);
        contacts = markDuplicateContacts(
          contacts,
          existingCompanyContacts,
          contactsPrimaryKey
        );
      }

      if (company.contactSelectionCriteria.length) {
        contacts = filterContacts({
          contacts,
          criteria: company.contactSelectionCriteria,
        });
      }

      const parts = splitArrayIntoParts(contacts, 10);
      if (!parts.length) {
        parentPort.postMessage({ progress: 100 });
        return;
      }

      const totalContacts = contacts.length;
      let processedCount = 0;

      // Process parts in parallel with controlled concurrency
      await Promise.all(
        parts.map(async (part) => {
          await webhooksController.recieveCompanyContacts({
            companyId,
            contacts: part,
          });
          processedCount += part.length;
          const progress = (processedCount / totalContacts) * 100;
          parentPort.postMessage({ progress });

          if (progress === 100) {
            await stripeController.calculateAndChargeContactOverage({
              companyId,
              stripeCustomerId,
              importedContactsCount: totalContacts,
              existingContactsCount: existingCompanyContactsCount,
            });
          }
        })
      );

      const companyActiveCampaigns =
        await companiesController.readCompanyActiveOngoingCampaigns({
          companyId,
        });
      await Promise.all(
        companyActiveCampaigns.map((campaign) =>
          campaignsController.runCampaign({ campaign })
        )
      );
    } catch (error) {
      parentPort.postMessage({ error: error.message });
      console.error("Worker thread error:", error);
      process.exit(1);
    } finally {
        await disconnectDbForThread();
    }
  }
);
