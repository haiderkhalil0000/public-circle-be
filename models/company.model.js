const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { COMPANY, USER },
  },
} = require("../utils");

const ObjectId = mongoose.Types.ObjectId;

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    companySize: { type: String },
    postalCode: { type: Number },
    address: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    user: { type: ObjectId, ref: USER, required: true },
    stripe: { type: Object, default: {} },
  },
  { timestamps: true }
);

const model = mongoose.model(COMPANY, schema, COMPANY);

module.exports = model;
