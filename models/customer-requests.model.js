const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { CUSTOMER_REQUESTS, COMPANY },
    CUSTOMER_REQUEST_TYPE,
    CUSTOMER_REQUEST_STATUS
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
      enum: Object.values(CUSTOMER_REQUEST_TYPE),
      required: true,
      default: CUSTOMER_REQUEST_TYPE.DEDICATED_IP_ENABLED,
    },
    requestStatus: {
      type: String,
      enum: Object.values(CUSTOMER_REQUEST_STATUS),
      default: CUSTOMER_REQUEST_STATUS.PENDING,
    },
    reason: {
      type: String,
      default: "",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const model = mongoose.model(CUSTOMER_REQUESTS, schema);

module.exports = model;
