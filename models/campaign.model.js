const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { CAMPAIGN, COMPANY, SEGMENT, TEMPLATE, DYNAMIC_TEMPLATE },
  },
} = require("../utils");
const {
  CAMPAIGN_STATUS,
  RUN_MODE,
  CRON_STATUS,
} = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    segments: [{ type: ObjectId, ref: SEGMENT }],
    sourceEmailAddress: {
      type: String,
      require: true,
    },
    emailSubject: {
      type: String,
      required: true,
    },
    emailTemplate: {
      type: ObjectId,
      required: true,
      ref: TEMPLATE,
    },
    dynamicEmailTemplate: {
      type: ObjectId,
      ref: DYNAMIC_TEMPLATE,
    },
    runMode: {
      type: String,
      required: true,
      enum: Object.values(RUN_MODE),
    },
    runSchedule: {
      type: Date,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPeriod: {
      type: String,
    },
    cronStatus: {
      type: String,
      enum: Object.values(CRON_STATUS),
      default: CRON_STATUS.PENDING,
    },
    lastProcessed: {
      type: Date,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(CAMPAIGN, schema);

module.exports = model;
