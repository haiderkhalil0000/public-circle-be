const mongoose = require("mongoose");
const { MONGODB_URL } = process.env;

const connectDbForThread = async () => {
  const options = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  };
  try {
    await mongoose.connect(MONGODB_URL, options);
    console.log("Connected to MongoDB in thread");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

const disconnectDbForThread = async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed successfully");
  } catch (error) {
    console.error("Error while closing MongoDB connection:", error);
  }
};

module.exports = { connectDbForThread, disconnectDbForThread };
