const { parentPort } = require("worker_threads");

const { companyContactsController } = require("../controllers");
const {
  connectDbForThread,
  disconnectDbForThread,
} = require("./db-connection-thread");

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
    console.error("Error in worker thread:", error);

    throw error;
  } finally {
    await disconnectDbForThread();
  }
});
