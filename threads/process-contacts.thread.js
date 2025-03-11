const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");

const { webhooksController, companiesController, campaignsController } = require("../controllers");

const { MONGODB_URL } = process.env;

const connectDbForThread = async () => {
  const options = {
    serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
    socketTimeoutMS: 45000, // Increase to 45 seconds
  };

  try {
    await mongoose.connect(MONGODB_URL, options);
  } catch (err) {
    console.log(err);
  }
};

const splitArrayIntoParts = (array, numberOfParts) => {
  const partSize = Math.ceil(array.length / numberOfParts); // Size of each part
  const parts = [];

  for (let i = 0; i < numberOfParts; i++) {
    const start = i * partSize; // Start index of the current part
    const end = start + partSize; // End index of the current part
    const part = array.slice(start, end); // Extract the part
    parts.push(part);
  }

  return parts;
};

function filterContacts({ contacts, criteria }) {
  return contacts.filter((contact) => {
    return criteria.every((criterion) => {
      const { filterKey, filterValues } = criterion;
      return filterValues.includes(contact[filterKey]);
    });
  });
}

parentPort.on("message", async (message) => {
  const companyContactsController = require("../controllers/company-contacts.controller");

  try {
    const { companyId, stripeCustomerId, contactsPrimaryKey, file } = message;

    const [
      _,
      company,
      existingCompanyContactsCount,
      existingCompanyContacts,
      duplicateContactsCount,
    ] = await Promise.all([
      connectDbForThread(),
      companiesController.readCompanyById({ companyId }),
      companyContactsController.readCompanyContactsCount({
        companyId,
      }),
      companyContactsController.readAllCompanyContacts({
        companyId,
      }),
      companyContactsController.readDuplicateContactsCountByCompanyId({
        companyId,
      }),
    ]);

    if (duplicateContactsCount) {
      parentPort.postMessage({
        error:
          "Duplicates found in your existing contacts, please resolve them before importing contacts again!",
      });

      process.exit(1);
    }

    let contacts = [];

    file.buffer = Buffer.from(file.buffer, "base64");

    const fileStream = Readable.from(file.buffer);

    const processCSV = new Promise((resolve, reject) => {
      fileStream
        .pipe(csvParser())
        .on("data", (data) => {
          if (Object.values(data).some((value) => value.trim() !== "")) {
            contacts.push(data);
          }
        })
        .on("end", () => resolve(contacts))
        .on("error", (err) => reject(err));
    });

    await processCSV;

    if (contactsPrimaryKey) {
      contacts = (() => {
        if (!contacts.length || !contactsPrimaryKey) return contacts;

        if (!(contactsPrimaryKey in contacts[0])) {
          return contacts;
        }
      
        const seen = new Set();
        return contacts.filter((contact) => {
          let primaryKeyValue = contact[contactsPrimaryKey];
      
          if (typeof primaryKeyValue === "string") {
            primaryKeyValue = primaryKeyValue.trim();
          }
      
          if (!primaryKeyValue) return false;
      
          if (seen.has(primaryKeyValue)) {
            return false;
          } else {
            seen.add(primaryKeyValue);
            return true;
          }
        });
      })();

      const existingContactsToBePending = [];

      existingCompanyContacts.forEach((ecc) => {
        const duplicateContact = contacts.find(
          (c) => c[contactsPrimaryKey] === ecc[contactsPrimaryKey]
        );

        if (duplicateContact) {
          contacts = contacts.map((item) => {
            if (
              item[contactsPrimaryKey] === duplicateContact[contactsPrimaryKey]
            ) {
              return {
                ...item,
                public_circles_existing_contactId: ecc._id,
              };
            }
            return item;
          });

          existingContactsToBePending.push(ecc._id);
        }
      });
    }

    if (company.contactSelectionCriteria.length) {
      contacts = filterContacts({
        contacts,
        criteria: company.contactSelectionCriteria,
      });
    }

    let parts = splitArrayIntoParts(contacts, 10);

    parts = parts.filter((part) => part.length);

    if (!parts.length) {
      parentPort.postMessage({
        progress: 100,
      });
    }

    let iteratedProgress = 0;

    const stripeController = require("../controllers/stripe.controller");

    parts.forEach(async (part) => {
      await webhooksController.recieveCompanyContacts({
        companyId,
        contacts: part,
      });

      iteratedProgress = iteratedProgress + part.length;

      parentPort.postMessage({
        progress: (iteratedProgress / contacts.length) * 100,
      });

      if ((iteratedProgress / contacts.length) * 100 === 100) {
        stripeController.calculateAndChargeContactOverage({
          companyId,
          stripeCustomerId,
          importedContactsCount: contacts.length,
          existingContactsCount: existingCompanyContactsCount,
        });
      }
    });

    const companyActiveCampaigns = await companiesController.readCompanyActiveCampaigns({
      companyId,
    });
    const runActiveCampaigns = [];
    for (const campaign of companyActiveCampaigns) {
       runActiveCampaigns.push(campaignsController.runCampaign({ campaign }));
    }
    await Promise.all(runActiveCampaigns);
  } catch (error) {
    console.error("Error in worker thread:", error);
  }
});
