const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { PLAN },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quota: {
      email: {
        type: Number,
        required: true,
        default: 0,
      },
      templateSize: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "CAD",
    },
    currencySymbol: {
      type: String,
      required: true,
      default: "$",
    },
  },
  { timestamps: true }
);

const model = new mongoose.model(PLAN, schema);

module.exports = model;
