const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { TEMPLATE, COMPANY, DYNAMIC_TEMPLATE },
  },
} = require("../utils");
const { TEMPLATE_STATUS, TEMPLATE_KINDS } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      index: true,
      ref: COMPANY,
    },
    name: {
      type: String,
      required: true,
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(TEMPLATE_KINDS),
    },
    body: {
      type: String,
      required: true,
    },
    json: {
      type: Object,
      required: true,
    },
    thumbnailURL: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TEMPLATE_STATUS),
      default: TEMPLATE_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(TEMPLATE, schema);

module.exports = model;
