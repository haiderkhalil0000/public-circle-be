const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { REFRESH_TOKEN },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(REFRESH_TOKEN, schema);

module.exports = model;
