const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { PLAN },
    ROLE_STATUS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    contactsRange: {
      from: { type: Number, required: true },
      to: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: Object.values(ROLE_STATUS),
      default: ROLE_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(PLAN, schema);

module.exports = model;
