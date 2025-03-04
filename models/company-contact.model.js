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
    public_circles_company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    public_circles_status: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_CONTACT_STATUS),
      default: COMPANY_CONTACT_STATUS.ACTIVE,
    },
  },
  {
    timestamps: {
      createdAt: "public_circles_createdAt", // Custom name for createdAt
      updatedAt: "public_circles_updatedAt", // Custom name for updatedAt
    },
    strict: false,
  }
);

const model = mongoose.model(COMPANY_CONTACT, schema);

module.exports = model;
