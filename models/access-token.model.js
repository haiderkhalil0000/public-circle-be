const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { ACCESS_TOKEN },
  },
} = require("../utils");
const { DOCUMENT_STATUS } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(ACCESS_TOKEN, schema);

module.exports = model;
