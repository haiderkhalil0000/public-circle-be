const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { COMPANY },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    companySize: { type: String },
    postalCode: { type: String },
    address: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    region: { type: String, default: "" },
    stripeCustomerId: { type: String },
    contactsPrimaryKey: { type: String },
    contactsDisplayOrder: [
      {
        type: String,
      },
    ],
    contactSelectionCriteria: [
      {
        filterKey: {
          type: String,
        },
        filterValues: [{ type: String }],
      },
    ],
    isMarkingDuplicates: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailKey: {
      type: String,
      default: "",
    },
    isContactFinalize: {
      type: Boolean,
      default: false,
    },
    purchasedPlan: {
      type: Array,
      default: [],
    },
    isRequestedForDedicatedIp: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(COMPANY, schema, COMPANY);

module.exports = model;
