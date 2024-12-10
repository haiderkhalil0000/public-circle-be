const createHttpError = require("http-errors");

const { Asset } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, ASSETS_STATUS },
} = require("../utils");

const createAsset = async ({ company, name, url }) => {
  const existingAssetDoc = await Asset.findOne({
    name,
  });

  if (existingAssetDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ASSET_EXISTS_ALREADY,
    });
  }

  Asset.create({
    company,
    name,
    url,
  });
};

const readAsset = async ({ assetId }) => {
  basicUtil.validateObjectId({ inputString: assetId });

  const assetDoc = await Asset.findById(assetId);

  if (!assetDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SOCIAL_LINK_NOT_FOUND,
    });
  }

  return assetDoc;
};

const readPaginatedAssets = async ({ pageNumber, pageSize }) => {
  const [totalRecords, assets] = await Promise.all([
    Asset.countDocuments(),
    Asset.find()
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    assets,
  };
};

const readAllAssets = () => Asset.find();

const updateAsset = async ({ assetId, assetData }) => {
  basicUtil.validateObjectId({ inputString: assetId });

  const result = await Asset.updateOne({ _id: assetId }, { ...assetData });

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ASSET_NOT_FOUND,
    });
  }
};

const deleteAsset = async ({ assetId }) => {
  basicUtil.validateObjectId({ inputString: assetId });

  const result = await Asset.updateOne(
    { _id: assetId },
    { status: ASSETS_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ASSET_NOT_FOUND,
    });
  }
};

module.exports = {
  createAsset,
  readAsset,
  readPaginatedAssets,
  readAllAssets,
  updateAsset,
  deleteAsset,
};
