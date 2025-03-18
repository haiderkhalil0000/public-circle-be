const { parentPort } = require("worker_threads");

const { companyContactsController } = require("../controllers");
const { Company } = require("../models");
const { connectDbForThread, disconnectDbForThread } = require("./db-connection-thread");

const { MONGODB_URL } = process.env;


parentPort.on("message", async (message) => {
  const { companyId, primaryKey } = message;

  try {
    await connectDbForThread();

    await Company.findByIdAndUpdate(companyId, { isMarkingDuplicates: true });

    await companyContactsController.markContactsDuplicateWithPrimaryKey({
      companyId,
      primaryKey,
    });

    await Company.findByIdAndUpdate(companyId, { isMarkingDuplicates: false });
    parentPort.postMessage({
      progress: 100,
    });
  } catch (error) {
    console.error("Error in worker thread:", error);
  } finally {
    await disconnectDbForThread();
  }
});
