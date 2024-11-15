const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { DYNAMIC_TEMPLATE, TEMPLATE, COMPANY },
    TEMPLATE_STATUS,
    TEMPLATE_KINDS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    staticTemplate: {
      type: ObjectId,
      required: true,
      index: true,
      ref: TEMPLATE,
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
      enum: Object.values(TEMPLATE_STATUS),
      default: TEMPLATE_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(DYNAMIC_TEMPLATE, schema);

module.exports = model;
