const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { CAMPAIGN },
  },
} = require("../utils");
const { DOCUMENT_STATUS } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
    },
    segments: [String],
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
    },
    sendTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(CAMPAIGN, schema);

module.exports = model;
