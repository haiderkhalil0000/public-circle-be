const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { TEMPLATE },
  },
} = require("../utils");
const { DOCUMENT_STATUS, TEMPLATE_KINDS } = require("../utils/constants.util");

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
    kind: {
      type: String,
      require: true,
      enum: Object.values(TEMPLATE_KINDS),
    },
    body: {
      type: String,
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

const model = mongoose.model(TEMPLATE, schema);

module.exports = model;
