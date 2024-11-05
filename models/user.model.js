const mongoose = require("mongoose");
const moment = require("moment");

const {
  constants: {
    MODELS: { USER, COMPANY },
  },
} = require("../utils");

const schema = new mongoose.Schema(
  {
    company: { type: mongoose.Types.ObjectId, ref: COMPANY },
    emailAddress: { type: String, index: true, required: true },
    password: { type: String, required: true },
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    secondaryEmail: { type: String, index: true },
    lastLoginAt: { type: Date, default: moment().format() },
    invalidLoginAttempts: { type: Number, default: 0 },
    isLoginWithEmailLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const model = mongoose.model(USER, schema);

module.exports = model;
