const createHttpError = require("http-errors");
const { s3Util } = require("../utils");

const { Asset } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, ASSETS_STATUS },
} = require("../utils");
const { deleteFileFromS3 } = require("../utils/s3.util");

const createAsset = async ({ company, name, url }) => {
  const existingAssetDoc = await Asset.findOne({
    name,
  });

  if (existingAssetDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ASSET_EXISTS_ALREADY,
    });
  }

  await Asset.create({
    company,
    name,
    url,
  });
};

const readAsset = async ({ assetId }) => {
  basicUtil.validateObjectId({ inputString: assetId });

  let assetDoc = await Asset.findById(assetId);
  assetDoc.url = s3Util.s3FileCompleteUrl(assetDoc.url);
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

const readAllAssets = async ({ companyId }) => {
  const assets = await Asset.find({
    company: companyId,
    status: ASSETS_STATUS.ACTIVE,
  });
  assets?.map((asset) => {
    asset.url = s3Util.s3FileCompleteUrl(asset.url);
  }
  );
  return assets;
};

const updateAsset = async ({ assetId}) => {
  basicUtil.validateObjectId({ inputString: assetId });

  let result = await Asset.findOneAndUpdate(
    { _id: assetId },
    { $set: { status: ASSETS_STATUS.ACTIVE } },
    { new: true }
  ).lean();
  
  if (!result) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ASSET_NOT_FOUND,
    });
  }

  result.url = s3Util.s3FileCompleteUrl(result.url);
  return result;
};

const deleteAsset = async ({ assetId, companyId }) => {
  basicUtil.validateObjectId({ inputString: assetId });
  const assetData = await Asset.findOne({ _id: assetId, company: companyId });
  if(assetData){
    await Promise.all([      
      deleteFileFromS3(assetData.url),
      Asset.findOneAndDelete({ _id: assetId, company: companyId })
    ]);
  }
};

const generateUploadFileSignedUrl = async ({fileName, companyId}) => {
  const fileType = `image/${fileName.substring(fileName.lastIndexOf('.') + 1)}`;
  const timeStamp = Date.now();
  const fileNameWithPath = `assets/${companyId}/email-assets/${timeStamp}-${fileName}`;
  const assetDoc = await Asset.create({
    company: companyId,
    name: fileName,
    url: fileNameWithPath,
    status: ASSETS_STATUS.IN_ACTIVE,
  })
  const signedUrl = await s3Util.generateUploadFileSignedUrl(
    fileNameWithPath,
    fileType
  );
  return {
    signedUrl,
    assetId: assetDoc._id,
  };
}

module.exports = {
  createAsset,
  readAsset,
  readPaginatedAssets,
  readAllAssets,
  updateAsset,
  deleteAsset,
  generateUploadFileSignedUrl,
};
