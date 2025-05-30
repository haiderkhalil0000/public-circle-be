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
    filters: [
      {
        key: { type: String },
        values: { type: Array },
        name: { type: String },
        type: { type: String, enum: ["CHECK_BOX", "INPUT", "RADIO", "DROP_DOWN"] },
        count: { type: Number },
        operator: { type: String, enum: ["AND", "OR"] },
        conditions: [
          {
            conditionType: { type: String },
            value: { type: String },
            fromValue: { type: String },
            toValue: { type: String },
          },
        ],
      },
    ],
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
