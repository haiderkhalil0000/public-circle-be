const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { ADD_ON },
    ADD_ON_STATUS,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true, default: "CAD" },
    status: {
      type: String,
      enum: Object.values(ADD_ON_STATUS),
      default: ADD_ON_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(ADD_ON, schema);

module.exports = model;
