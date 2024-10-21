const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { SEGMENT },
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
    name: {
      type: String,
      required: true,
    },
    filters: {
      type: Object,
      require: true,
    },
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(SEGMENT, schema);

module.exports = model;
