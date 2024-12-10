const createHttpError = require("http-errors");

const { SocialLink } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, SOCIAL_LINK_STATUS },
} = require("../utils");

const createSocialLink = async ({ company, name, url }) => {
  const existingSocialLinkDoc = await SocialLink.findOne({
    name,
  });

  if (existingSocialLinkDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.SOCIAL_LINK_EXISTS_ALREADY,
    });
  }

  SocialLink.create({
    company,
    name,
    url,
  });
};

const readSocialLink = async ({ socialLinkId }) => {
  basicUtil.validateObjectId({ inputString: socialLinkId });

  const socialLinkDoc = await SocialLink.findById(socialLinkId);

  if (!socialLinkDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SOCIAL_LINK_NOT_FOUND,
    });
  }

  return socialLinkDoc;
};

const readPaginatedSocialLinks = async ({ pageNumber, pageSize }) => {
  const [totalRecords, socialLinks] = await Promise.all([
    SocialLink.countDocuments(),
    SocialLink.find()
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    socialLinks,
  };
};

const readAllSocialLinks = () => SocialLink.find();

const updateSocialLink = async ({ socialLinkId, socialLinkData }) => {
  basicUtil.validateObjectId({ inputString: socialLinkId });

  const result = await SocialLink.updateOne(
    { _id: socialLinkId },
    { ...socialLinkData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SOCIAL_LINK_NOT_FOUND,
    });
  }
};

const deleteSocialLink = async ({ socialLinkId }) => {
  basicUtil.validateObjectId({ inputString: socialLinkId });

  const result = await SocialLink.updateOne(
    { _id: socialLinkId },
    { status: SOCIAL_LINK_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SOCIAL_LINK_NOT_FOUND,
    });
  }
};

module.exports = {
  createSocialLink,
  readSocialLink,
  readPaginatedSocialLinks,
  readAllSocialLinks,
  updateSocialLink,
  deleteSocialLink,
};
