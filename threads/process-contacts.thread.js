const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const lodash = require("lodash");
const differenceWith = require("lodash/differenceWith");

const { webhooksController, companiesController } = require("../controllers");

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

    const [_, company, existingCompanyContactsCount, existingCompanyContacts] =
      await Promise.all([
        connectDbForThread(),
        companiesController.readCompanyById({ companyId }),
        companyContactsController.readCompanyContactsCount({
          companyId,
        }),
        companyContactsController.readAllCompanyContacts({
          companyId,
        }),
      ]);

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
      contacts = lodash.uniqBy(contacts, "email");

      contacts = differenceWith(
        contacts,
        existingCompanyContacts,
        (contacts, existingCompanyContacts) => {
          return (
            contacts[contactsPrimaryKey] ===
            existingCompanyContacts[contactsPrimaryKey]
          );
        }
      );
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
