const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { OVERAGE_CONSUMPTION, COMPANY },
  },
} = require("../utils");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    customerId: {
      type: String,
      required: true,
    },
    description: { type: String, required: true },
    previousBalance: {
      type: Number,
    },
    currentBalance: {
      type: Number,
    },
    emailOverage: {
      type: String,
    },
    emailOverageCharge: {
      type: Number,
    },
    emailContentOverage: {
      type: String,
    },
    emailContentOverageCharge: {
      type: Number,
    },
    contactOverage: {
      type: String,
    },
    contactOverageCharge: {
      type: Number,
    },
    currency: {
      type: String,
      required: true,
      default: "CAD",
    },
    kind: {
      type: String,
      required: true,
      default: OVERAGE_CONSUMPTION_KIND.PUBLIC,
      enum: Object.values(OVERAGE_CONSUMPTION_KIND),
    },
    stripeInvoiceItemId: {
      type: String,
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
