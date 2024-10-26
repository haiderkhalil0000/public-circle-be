const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { CRON_JOB },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    cronName: { type: String, required: true },
    interval: { type: String, required: true },
    lastRunAt: { type: Date, required: true },
    recordsUpdated: { type: Number },
    duration: {
      startTime: Date,
      endTime: Date,
    },
  },
  { timestamps: true }
);

const model = new mongoose.model(CRON_JOB, schema);

module.exports = model;
