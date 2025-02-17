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
      bandwidth: {
        type: Number,
        required: true,
        default: 0,
      },
      contact: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    bundles: {
      email: {
        emails: {
          type: Number,
          required: true,
          default: 0,
        },
        priceInSmallestUnit: { type: Number, required: true, default: 0 },
      },
      bandwidth: {
        bandwidth: {
          type: Number,
          required: true,
          default: 0,
        },
        priceInSmallestUnit: {
          type: Number,
          required: true,
          default: 0,
        },
      },
      contact: {
        contacts: {
          type: Number,
          required: true,
          default: 0,
        },
        priceInSmallestUnit: {
          type: Number,
          required: true,
          default: 0,
        },
      },
    },
    priceInSmallestUnit: {
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
