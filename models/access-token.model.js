const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { ACCESS_TOKEN, COMPANY },
    ACCESS_TOKEN_STATUS,
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
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ACCESS_TOKEN_STATUS),
      default: ACCESS_TOKEN_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(ACCESS_TOKEN, schema);

module.exports = model;
