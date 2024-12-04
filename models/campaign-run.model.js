const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { CAMPAIGN_RUN, COMPANY, CAMPAIGN },
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
    campaign: {
      type: ObjectId,
      required: true,
      index: true,
      ref: CAMPAIGN,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(CAMPAIGN_RUN, schema);

module.exports = model;
