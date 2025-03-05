const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const lodash = require("lodash");

const { webhooksController, companiesController } = require("../controllers");
const {
  constants: { COMPANY_CONTACT_STATUS },
} = require("../utils");
const { CompanyContact } = require("../models");

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
      pendingCompanyContactsCount,
    ] = await Promise.all([
      connectDbForThread(),
      companiesController.readCompanyById({ companyId }),
      companyContactsController.readCompanyContactsCount({
        companyId,
      }),
      companyContactsController.readAllCompanyContacts({
        companyId,
      }),
      companyContactsController.readPendingContactsCountByCompanyId({
        companyId,
      }),
    ]);

    if (pendingCompanyContactsCount) {
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
        .on("data", (data) => contacts.push(data)) // Collect each row of CSV data
        .on("end", () => resolve(contacts))
        .on("error", (err) => reject(err));
    });

    await processCSV;

    if (contactsPrimaryKey) {
      let duplicates = lodash
        .chain(contacts)
        .groupBy(contactsPrimaryKey)
        .filter((group) => group.length > 1)
        .map((group) => group[0].email)
        .value();

      const mappedDbContacts = existingCompanyContacts.map(
        (contact) => contact[contactsPrimaryKey]
      );

      contacts = (() => {
        const seen = {};
        return contacts.filter((contact) => {
          const primaryKeyValue = contact[contactsPrimaryKey]; // Get the email value
          // Check if the email exists in the mappedDbContacts array
          const maxAllowed = mappedDbContacts.includes(primaryKeyValue) ? 1 : 2;
          seen[primaryKeyValue] = (seen[primaryKeyValue] || 0) + 1; // Track the count for this email
          return seen[primaryKeyValue] <= maxAllowed; // Filter based on the count
        });
      })();

      contacts = contacts.map((item) => {
        if (!duplicates.includes(item[contactsPrimaryKey])) {
          return item;
        }

        return {
          ...item,
          public_circles_status: COMPANY_CONTACT_STATUS.PENDING,
        };
      });

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
                public_circles_existing_contactId: ecc._id
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
  } catch (error) {
    console.error("Error in worker thread:", error);
  }
});
