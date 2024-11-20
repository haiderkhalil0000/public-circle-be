const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { COMPANY_USER, COMPANY },
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
  },
  { timestamps: true, strict: false }
);

const model = mongoose.model(COMPANY_USER, schema);

module.exports = model;
