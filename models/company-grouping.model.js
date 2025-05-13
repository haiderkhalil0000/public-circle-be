const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { COMPANY_GROUPING, COMPANY },
    COMPANY_GROUPING_TYPES,
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
    type: {
      type: String,
      enum: Object.values(COMPANY_GROUPING_TYPES),
      required: true,
      default: COMPANY_GROUPING_TYPES.TEMPLATE,
    },
    groupName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(COMPANY_GROUPING, schema);

module.exports = model;
