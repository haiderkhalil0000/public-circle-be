const mongoose = require("mongoose");
const moment = require("moment");

const {
  constants: {
    MODELS: { USER, COMPANY, ROLE },
    USER_STATUS,
    USER_KIND,
  },
} = require("../utils");

const ObjectId = mongoose.Types.ObjectId;

const schema = new mongoose.Schema(
  {
    company: { type: ObjectId, ref: COMPANY },
    emailAddress: { type: String, index: true, required: true },
    password: { type: String },
    profilePicture: { type: String },
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    secondaryEmail: { type: String, index: true },
    lastLoginAt: { type: Date, default: moment().format() },
    invalidLoginAttempts: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    isLoginWithEmailLocked: { type: Boolean, default: false },
    role: {
      type: ObjectId,
      default: new mongoose.Types.ObjectId("673133ab145111f65ba06075"),
      ref: ROLE,
    },
    isResetPasswordRequested: { type: Boolean, default: false },
    signUpStepsCompleted: { type: Number, min: 0, max: 8, default: 0 },
    referralCode: { type: String },
    referrer: { type: ObjectId, ref: USER },
    referree: { type: ObjectId, ref: USER },
    kind: {
      type: String,
      required: true,
      default: USER_KIND.PRIMARY,
      enum: Object.values(USER_KIND),
    },
    status: {
      type: String,
      default: USER_STATUS.ACTIVE,
      enum: Object.values(USER_STATUS),
    },
  },
  { timestamps: true }
);

const model = mongoose.model(USER, schema);

module.exports = model;
