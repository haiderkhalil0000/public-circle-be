const mongoose = require("mongoose");
const moment = require("moment");

const { companySchema } = require("../schemas");

const {
  constants: {
    MODELS: { USER },
  },
} = require("../utils");

const schema = new mongoose.Schema({
  company: { type: companySchema },
  emailAddress: { type: String, index: true, required: true },
  password: { type: String, required: true },
  firstName: { type: String, index: true, required: true },
  lastName: { type: String, index: true, required: true },
  lastLoginAt: { type: Date, default: moment().format() },
  invalidLoginAttempts: { type: Number, default: 0 },
  isLoginWithEmailLocked: { type: Boolean, default: false },
});

const model = mongoose.model(USER, schema);

module.exports = model;
