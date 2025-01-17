const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { OVERAGE_CONSUMPTION, COMPANY },
    OVERAGE_CONSUMPTION_DOCUMENT_KIND,
    OVERAGE_KIND,
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
    customerId: {
      type: String,
      required: true,
    },
    description: { type: String, required: true },
    overage: {
      type: String,
    },
    overageCharge: {
      type: Number,
    },
    currency: {
      type: String,
      required: true,
      default: "CAD",
    },
    overageKind: {
      type: String,
      required: true,
      enum: Object.values(OVERAGE_KIND),
    },
    documentKind: {
      type: String,
      required: true,
      enum: Object.values(OVERAGE_CONSUMPTION_DOCUMENT_KIND),
      default: OVERAGE_CONSUMPTION_DOCUMENT_KIND.PUBLIC,
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
