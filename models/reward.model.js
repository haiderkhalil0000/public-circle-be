const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { REWARD },
    REWARD_KIND,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: Object.values(REWARD_KIND),
    },
    trialInDays: { type: Number, default: 0 },
    discountInDays: { type: Number, default: 0 },
    currency: { type: String, default: "CAD" },
    currencySymbol: { type: String, default: "$" },
    discounts: {
      fixedDiscount: { type: Number, default: 0 },
      percentageDiscount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const model = new mongoose.model(REWARD, schema);

module.exports = model;
