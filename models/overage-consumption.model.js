const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { OVERAGE_CONSUMPTION, COMPANY },
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
    description: { type: String, required: true },
    overageCount: {
      type: Number,
    },
    overagePrice: {
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
      enum: Object.values(OVERAGE_KIND),
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
