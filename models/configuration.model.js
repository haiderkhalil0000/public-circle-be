const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;
const {
  constants: {
    MODELS: { CONFIGURATION },
  },
} = require("../utils");
const { DOCUMENT_STATUS } = require("../utils/constants.util");

const schema = new mongoose.Schema({
  companyId: {
    type: ObjectId,
    required: true,
    index: true,
  },
  emailConfigurations: {
    addresses: [
      {
        emailAddress: String,
        isVerified: { type: Boolean, default: false },
        isDefault: { type: Boolean, default: false },
        status: {
          type: String,
          default: DOCUMENT_STATUS.ACTIVE,
          enum: Object.values(DOCUMENT_STATUS),
        },
      },
    ],
    domains: [
      {
        emailDomain: String,
        isVerified: { type: Boolean, default: false, required: true },
        isDefault: { type: Boolean, default: false },
        dnsInfo: {
          Name: String,
          Type: String,
          Value: String,
        },
        status: {
          type: String,
          default: DOCUMENT_STATUS.ACTIVE,
          enum: Object.values(DOCUMENT_STATUS),
          required: true,
        },
        addresses: [
          {
            emailAddress: String,
            isDefault: { type: Boolean, default: false },
            status: {
              type: String,
              default: DOCUMENT_STATUS.ACTIVE,
              enum: Object.values(DOCUMENT_STATUS),
              required: true,
            },
          },
        ],
      },
    ],
  },
});

const model = mongoose.model(CONFIGURATION, schema);

module.exports = model;
