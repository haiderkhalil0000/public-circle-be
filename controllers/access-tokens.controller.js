const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");

const { AccessToken } = require("../models");
const {
  RESPONSE_MESSAGES,
  DOCUMENT_STATUS,
} = require("../utils/constants.util");
const { basicUtil } = require("../utils");

const createAccessToken = async ({ title, companyId }) => {
  const existingToken = await AccessToken.findOne({ title, companyId });

  if (existingToken) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_EXISTS,
    });
  }

  const doc = await AccessToken.create({ companyId, title });

  const { createToken } = require("../middlewares/authenticator.middleware");

  return createToken({ _id: doc._id });
};

const readAccessToken = async ({ accessTokenId, companyId }) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const accessTokenDoc = await AccessToken.findOne({
    _id: accessTokenId,
    companyId,
  });

  if (!accessTokenDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
    });
  }

  return accessTokenDoc;
};

const readAccessTokens = async ({ companyId, pageNumber, pageSize }) => {
  const [totalCount, accessTokens] = await Promise.all([
    AccessToken.countDocuments({ companyId, status: DOCUMENT_STATUS.ACTIVE }),
    AccessToken.find({ companyId, status: DOCUMENT_STATUS.ACTIVE })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    accessTokens,
  };
};

const readAllAccessTokens = ({ companyId }) =>
  AccessToken.find({ companyId, status: DOCUMENT_STATUS.ACTIVE });

const updateAccessToken = async ({
  companyId,
  accessTokenId,
  title,
  status,
}) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const result = await AccessToken.updateOne(
    { _id: accessTokenId, companyId },
    { title, status }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_UPDATED_ALREADY,
    });
  }
};

const deleteAccessToken = async ({ companyId, accessTokenId }) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const result = await AccessToken.updateOne(
    {
      _id: accessTokenId,
      companyId,
    },
    { status: DOCUMENT_STATUS.DELETED }
  );

  if (!result.deletedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createAccessToken,
  readAccessToken,
  readAccessTokens,
  readAllAccessTokens,
  updateAccessToken,
  deleteAccessToken,
};
