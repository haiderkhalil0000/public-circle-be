const mongoose = require("mongoose");
const { RESPONSE_MESSAGES } = require("./constants.util");
const createError = require("http-errors");

const getMongoDbObjectId = ({ inputString = "" }) => {
  if (inputString.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_OBJECT_ID,
    });
  }

  return new mongoose.Types.ObjectId(inputString);
};

module.exports = {
  getMongoDbObjectId,
};
