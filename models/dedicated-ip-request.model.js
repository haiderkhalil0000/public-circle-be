const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { DEDICATED_IP_REQUEST, COMPANY },
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
  },
  { timestamps: true }
);

const model = mongoose.model(DEDICATED_IP_REQUEST, schema);

module.exports = model;
