const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { TOPUP, COMPANY },
  },
} = require("../utils");

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    stripeInvoiceId: { type: String, required: true },
    stripeCreatedAt: { type: Date, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true, default: "CAD" },
  },
  { timestamps: true }
);

const model = mongoose.model(TOPUP, schema);

module.exports = model;
