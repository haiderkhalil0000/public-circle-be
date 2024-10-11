const mongoose = require("mongoose");

const {
  constants: {
    MODELS: { FILTER },
    FILTER_TYPES,
    DOCUMENT_STATUS,
  },
} = require("../utils");

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
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
      default: DOCUMENT_STATUS.ACTIVE,
      enum: Object.values(DOCUMENT_STATUS),
    },
  },
  { timestamps: true }
);

const model = mongoose.model(FILTER, schema);

module.exports = model;
