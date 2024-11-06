const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { COMPANY, USER },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    noOfEmployees: { type: Number },
    postalCode: { type: Number },
    address: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    user: { type: mongoose.Types.ObjectId, ref: USER, required: true },
  },
  { timestamps: true }
);

const model = mongoose.model(COMPANY, schema, COMPANY);

module.exports = model;
