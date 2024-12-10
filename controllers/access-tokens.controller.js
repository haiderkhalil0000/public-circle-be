const createHttpError = require("http-errors");

const { AccessToken } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, ACCESS_TOKEN_STATUS },
} = require("../utils");

const createAccessToken = async ({ title, companyId }) => {
  const existingToken = await AccessToken.findOne({
    title,
    company: companyId,
    status: ACCESS_TOKEN_STATUS.ACTIVE,
  });

  if (existingToken) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_EXISTS,
    });
  }

  const accessTokenDoc = await AccessToken.create({
    company: companyId,
    title,
  });

  const {
    generateAccessToken,
  } = require("../middlewares/authenticator.middleware");

  return generateAccessToken({ payload: { _id: accessTokenDoc._id } });
};

const readAccessToken = async ({ accessTokenId, companyId }) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const accessTokenDoc = await AccessToken.findOne({
    _id: accessTokenId,
    company: companyId,
  });

  if (!accessTokenDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
    });
  }

  return accessTokenDoc;
};

const readPaginatedAccessTokens = async ({
  companyId,
  pageNumber,
  pageSize,
}) => {
  const [totalRecords, accessTokens] = await Promise.all([
    AccessToken.countDocuments({
      company: companyId,
      status: ACCESS_TOKEN_STATUS.ACTIVE,
    }),
    AccessToken.find({ company: companyId, status: ACCESS_TOKEN_STATUS.ACTIVE })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    accessTokens,
  };
};

const readAllAccessTokens = ({ companyId }) =>
  AccessToken.find({ company: companyId, status: ACCESS_TOKEN_STATUS.ACTIVE });

const updateAccessToken = async ({
  companyId,
  accessTokenId,
  title,
  status,
}) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const result = await AccessToken.updateOne(
    { _id: accessTokenId, company: companyId },
    { title, status }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
    });
  }
};

const deleteAccessToken = async ({ companyId, accessTokenId }) => {
  basicUtil.validateObjectId({ inputString: accessTokenId });

  const result = await AccessToken.updateOne(
    {
      _id: accessTokenId,
      company: companyId,
    },
    { status: ACCESS_TOKEN_STATUS.DELETED }
  );

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ACCESS_TOKEN_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createAccessToken,
  readAccessToken,
  readPaginatedAccessTokens,
  readAllAccessTokens,
  updateAccessToken,
  deleteAccessToken,
};
