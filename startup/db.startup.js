const mongoose = require("mongoose");

const { MONGODB_URL } = process.env;

const options = {
  serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
  socketTimeoutMS: 45000, // Increase to 45 seconds
};

module.exports = {
  connect: () => {
    mongoose
      .connect(MONGODB_URL, options)
      .then(() => console.log("Connected to database."))
      .catch((err) => console.log(err));
  },
  disconnect: () => {
    mongoose
      .disconnect()
      .then(() => {
        console.log("Disconnected from database.");
      })
      .catch((error) => {
        console.log("Error while disconnecting:", error);
      });
  },
};
