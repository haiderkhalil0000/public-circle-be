const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { EMAILS_SENT, COMPANY, CAMPAIGN, CAMPAIGN_RUN },
    EMAIL_KIND,
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      index: true,
      ref: COMPANY,
    },
    campaign: {
      type: ObjectId,
      index: true,
      ref: CAMPAIGN,
    },
    campaignRun: {
      type: ObjectId,
      index: true,
      ref: CAMPAIGN_RUN,
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(EMAIL_KIND),
    },
    fromEmailAddress: {
      type: String,
      required: true,
    },
    toEmailAddress: {
      type: String,
      required: true,
    },
    emailSubject: {
      type: String,
      required: true,
    },
    emailContent: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      default: 0,
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
