const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { COMPANY_CONTACT, COMPANY },
    COMPANY_CONTACT_STATUS,
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
    status: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_CONTACT_STATUS),
      default: COMPANY_CONTACT_STATUS.ACTIVE,
    },
  },
  { timestamps: true, strict: false }
);

const model = mongoose.model(COMPANY_CONTACT, schema);

module.exports = model;
