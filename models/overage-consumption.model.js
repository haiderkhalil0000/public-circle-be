const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { OVERAGE_CONSUMPTION },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    previousBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    emailOverage: {
      type: String,
      required: true,
      default: "",
    },
    emailContentOverage: {
      type: String,
      required: true,
      default: "",
    },
    emailOverageCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    emailContentOverageCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "CAD",
    },
  },
  { timestamps: true }
);

const model = new mongoose.model(
  OVERAGE_CONSUMPTION,
  schema,
  OVERAGE_CONSUMPTION
);

module.exports = model;
