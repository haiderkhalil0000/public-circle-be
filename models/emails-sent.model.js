const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { EMAILS_SENT, COMPANY },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
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
  },
  { timestamps: true, strict: false }
);

const model = mongoose.model(EMAILS_SENT, schema, EMAILS_SENT);

module.exports = model;
