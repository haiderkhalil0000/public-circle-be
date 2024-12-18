const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { COMPANY, PLAN },
  },
} = require("../utils");

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    companySize: { type: String },
    postalCode: { type: Number },
    address: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    stripe: { type: Object, default: {} },
    plan: { type: ObjectId, ref: PLAN },
  },
  { timestamps: true }
);

const model = mongoose.model(COMPANY, schema, COMPANY);

module.exports = model;
