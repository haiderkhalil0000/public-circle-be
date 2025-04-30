const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { ASSET, COMPANY },
    ASSETS_STATUS,
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
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: false,
      default: 0,
    },
    url: {
      type: String,
      required: false,
      default: "",
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ASSETS_STATUS),
      default: ASSETS_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(ASSET, schema);

module.exports = model;
