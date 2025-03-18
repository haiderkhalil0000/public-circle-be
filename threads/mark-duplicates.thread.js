const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");

const { companyContactsController } = require("../controllers");
const { Company } = require("../models");

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

parentPort.on("message", async (message) => {
  const { companyId, primaryKey } = message;

  try {
    await connectDbForThread();

    await companyContactsController.updateMarkingDuplicatesStatus({
      companyId,
      status: true,
    });

    await companyContactsController.markContactsDuplicateWithPrimaryKey({
      companyId,
      primaryKey,
    });

    await companyContactsController.updateMarkingDuplicatesStatus({
      companyId,
      status: false,
    });

    parentPort.postMessage({
      progress: 100,
    });
  } catch (error) {
    await companyContactsController.updateMarkingDuplicatesStatus({
      companyId,
      status: false,
    });

    console.error("Error in worker thread:", error);

    throw error;
  }
});
