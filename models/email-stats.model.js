const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { EMAIL_STATS },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
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
  },
  { strict: false }
);

const model = mongoose.model(EMAIL_STATS, schema);

module.exports = model;
