const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { SOCIAL_LINK, COMPANY },
    SOCIAL_LINK_STATUS,
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
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(SOCIAL_LINK_STATUS),
      default: SOCIAL_LINK_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(SOCIAL_LINK, schema);

module.exports = model;
