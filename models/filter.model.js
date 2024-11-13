const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { FILTER, COMPANY },
    FILTER_TYPES,
    FILTER_STATUS,
  },
} = require("../utils");

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY,
    },
    filterLabel: {
      type: String,
      required: true,
    },
    filterType: {
      type: String,
      required: true,
      enum: Object.values(FILTER_TYPES),
    },
    filterKey: {
      type: String,
      required: true,
    },
    filterValues: {
      type: Array,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: FILTER_STATUS.ACTIVE,
      enum: Object.values(FILTER_STATUS),
    },
  },
  { timestamps: true }
);

const model = mongoose.model(FILTER, schema);

module.exports = model;
