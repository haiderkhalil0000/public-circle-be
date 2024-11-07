const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { PLAN },
    PLAN_STATUS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    contactsRange: {
      from: { type: Number, required: true },
      to: { type: Number, required: true },
    },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(PLAN_STATUS),
      default: PLAN_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(PLAN, schema);

module.exports = model;
