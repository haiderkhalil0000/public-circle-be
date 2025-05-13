const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { TEMPLATE, TEMPLATE_CATEGORY, COMPANY, USER, COMPANY_GROUPING },
  },
} = require("../utils");
const { TEMPLATE_STATUS, TEMPLATE_KINDS } = require("../utils/constants.util");

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      index: true,
      ref: COMPANY,
    },
    name: {
      type: String,
      required: true,
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(TEMPLATE_KINDS),
    },
    body: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    sizeUnit: {
      type: String,
      required: true,
      default: "Bytes",
    },
    thumbnailURL: {
      type: String,
      required: true,
    },
    category: {
      type: ObjectId,
      ref: TEMPLATE_CATEGORY,
    },
    jsonTemplate: {
      type: Object,
      required: false,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(TEMPLATE_STATUS),
      default: TEMPLATE_STATUS.ACTIVE,
      required: true,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    existingTemplateId: {
      type: ObjectId,
      ref: TEMPLATE,
      default: null,
    },
    updatedBy: {
      type: ObjectId,
      ref: USER,
      index: true,
      default: null,
    },
    companyGroupingId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: COMPANY_GROUPING,
    },
  },
  { timestamps: true }
);

const model = mongoose.model(TEMPLATE, schema);

module.exports = model;
