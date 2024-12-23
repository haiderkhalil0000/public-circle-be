const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { SEGMENT, COMPANY },
  },
} = require("../utils");
const { SEGMENT_STATUS } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    name: {
      type: String,
      required: true,
    },
    filters: {
      type: Object,
      require: true,
    },
    status: {
      type: String,
      enum: Object.values(SEGMENT_STATUS),
      default: SEGMENT_STATUS.ACTIVE,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(SEGMENT, schema);

module.exports = model;
