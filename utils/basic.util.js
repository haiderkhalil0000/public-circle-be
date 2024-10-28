const mongoose = require("mongoose");

const getMongoDbObjectId = ({ inputString = "" }) =>
  new mongoose.Types.ObjectId(inputString);

module.exports = {
  getMongoDbObjectId,
};
