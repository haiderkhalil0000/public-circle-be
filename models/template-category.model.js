const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { TEMPLATE_CATEGORY },
    TEMPLATE_CATEGORY_STATUS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TEMPLATE_CATEGORY_STATUS),
      default: TEMPLATE_CATEGORY_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(TEMPLATE_CATEGORY, schema, TEMPLATE_CATEGORY);

module.exports = model;
