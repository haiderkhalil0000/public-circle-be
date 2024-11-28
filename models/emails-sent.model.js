const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { EMAILS_SENT, COMPANY, CAMPAIGN },
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
    fromEmailAddress: {
      type: String,
      require: true,
    },
    toEmailAddress: {
      type: String,
      require: true,
    },
    emailSubject: {
      type: String,
      required: true,
    },
    emailContent: {
      type: String,
      required: true,
    },
    sesMessageId: {
      type: String,
    },
    emailEvents: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const model = mongoose.model(EMAILS_SENT, schema, EMAILS_SENT);

module.exports = model;
