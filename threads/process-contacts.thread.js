const mongoose = require("mongoose");
const { parentPort } = require("worker_threads");
const { Readable } = require("stream");
const csvParser = require("csv-parser");

const webhooksController = require("../controllers/webhooks.controller");
const { emitMessage, getSocket } = require("../socket");
const { SOCKET_CHANNELS } = require("../utils/constants.util");

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
  try {
    await connectDbForThread();

    const { companyId, stripeCustomerId, currentUserId, file } = message;

    const results = [];

    file.buffer = Buffer.from(file.buffer, "base64");

    const fileStream = Readable.from(file.buffer);

    const processCSV = new Promise((resolve, reject) => {
      fileStream
        .pipe(csvParser())
        .on("data", (data) => results.push(data)) // Collect each row of CSV data
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });

    await processCSV;

    await webhooksController.recieveCompanyContacts({
      companyId,
      stripeCustomerId,
      users: results,
    });

    const targetSocket = getSocket({ userId: currentUserId });

    emitMessage({
      socketObj: targetSocket,
      socketChannel: SOCKET_CHANNELS.CONTACTS_UPLOAD_PROGRESS,
      message: {
        progress: 100,
      },
    });
  } catch (error) {
    console.error("Error in worker thread:", error);
  }
});
