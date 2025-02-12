const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");

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
  try {
    const { companyId, stripeCustomerId, file } = message;

    const [_, company] = await Promise.all([
      connectDbForThread(),
      companiesController.readCompanyById({ companyId }),
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

    if (company.contactSelectionCriteria) {
      contacts = filterContacts({
        contacts,
        criteria: company.contactSelectionCriteria,
      });
    }

    const parts = splitArrayIntoParts(contacts, 10);

    let iteratedProgress = 0;

    parts.forEach(async (item) => {
      await webhooksController.recieveCompanyContacts({
        companyId,
        stripeCustomerId,
        users: item,
      });

      iteratedProgress = iteratedProgress + item.length;

      parentPort.postMessage({
        progress: (iteratedProgress / contacts.length) * 100,
      });
    });
  } catch (error) {
    console.error("Error in worker thread:", error);
  }
});
