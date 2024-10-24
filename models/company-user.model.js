const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { COMPANY_USER },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true, strict: false, timestamps: true }
);

const model = mongoose.model(COMPANY_USER, schema);

module.exports = model;
