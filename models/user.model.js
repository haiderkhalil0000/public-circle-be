const mongoose = require("mongoose");
const moment = require("moment");

const {
  constants: {
    MODELS: { USER, COMPANY, ROLE },
  },
} = require("../utils");

const ObjectId = mongoose.Types.ObjectId;

const schema = new mongoose.Schema(
  {
    company: { type: ObjectId, ref: COMPANY },
    emailAddress: { type: String, index: true, required: true },
    password: { type: String, required: true },
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    secondaryEmail: { type: String, index: true },
    lastLoginAt: { type: Date, default: moment().format() },
    invalidLoginAttempts: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    isLoginWithEmailLocked: { type: Boolean, default: false },
    role: { type: ObjectId, ref: ROLE },
  },
  { timestamps: true }
);

const model = mongoose.model(USER, schema);

module.exports = model;
