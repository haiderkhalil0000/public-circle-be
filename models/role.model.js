const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { ROLE },
    ROLE_STATUS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    permissions: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(ROLE_STATUS),
      default: ROLE_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(ROLE, schema);

module.exports = model;
