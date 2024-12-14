const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { REFERRAL_CODE, USER, REWARD },
  },
} = require("../utils");

const ObjectId = mongoose.Types.ObjectId;

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    user: { type: ObjectId, required: true, ref: USER },
    reward: { type: ObjectId, ref: REWARD },
  },
  { timestamps: true }
);

const model = new mongoose.model(REFERRAL_CODE, schema);

module.exports = model;
