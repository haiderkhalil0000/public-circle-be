const mongoose = require("mongoose");
const createError = require("http-errors");

const { Campaign, Template, CompanyUser } = require("../models");
const {
  DOCUMENT_STATUS,
  RESPONSE_MESSAGES,
} = require("../utils/constants.util");
const { sendEmail } = require("../utils/ses.util");

const createCampaign = async ({
  companyId,
  segment = "",
  sourceEmailAddress,
  emailSubject,
  emailTemplate = "",
  sendTime,
}) => {
  segment = new mongoose.Types.ObjectId(segment);
  emailTemplate = new mongoose.Types.ObjectId(emailTemplate);

  const existingCampaign = await Campaign.findOne({
    segment,
    companyId,
  });

  if (existingCampaign) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_CAMPAIGN,
    });
  }

  Campaign.create({
    companyId,
    segment,
    sourceEmailAddress,
    emailSubject,
    emailTemplate,
    sendTime,
  });
};

const readCampaign = async ({ campaignId = "" }) => {
  if (campaignId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_CAMPAIGN_ID,
    });
  }

  campaignId = new mongoose.Types.ObjectId(campaignId);

  const campaign = await Campaign.findById(
    new mongoose.Types.ObjectId(campaignId)
  );

  if (!campaign) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  return campaign;
};

const readAllCampaigns = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, allCampaigns] = await Promise.all([
    Campaign.countDocuments({ companyId }),
    Campaign.find({ companyId })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  if (!allCampaigns.length) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.NO_CAMPAIGNS,
    });
  }

  return {
    totalRecords,
    allCampaigns,
  };
};

const updateCampaign = async ({ campaignId = "", campaignData }) => {
  if (campaignId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_CAMPAIGN_ID,
    });
  }

  campaignId = new mongoose.Types.ObjectId(campaignId);

  const result = await Campaign.updateOne(
    { _id: new mongoose.Types.ObjectId(campaignId) },
    { ...campaignData }
  );

  if (!result.matchedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_UPDATED_ALREADY,
    });
  }
};

const deleteCampaign = async ({ campaignId = "" }) => {
  campaignId = new mongoose.Types.ObjectId(campaignId);

  const result = await Campaign.updateOne(
    { _id: campaignId, status: DOCUMENT_STATUS.ACTIVE },
    {
      status: DOCUMENT_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_DELETED_ALREADY,
    });
  }
};

const mapDynamicValues = async ({ companyId, emailAddress, content }) => {
  const companyData = await CompanyUser.findOne({
    companyId,
    email: emailAddress,
  }).lean();

  if (!companyData) {
    throw createError(400, { errorMessage: "Something went wrong!" });
  }

  // Iterate over the user's keys and replace placeholders dynamically
  let modifiedContent = content;

  for (const [key, value] of Object.entries(companyData)) {
    const placeholder = `#${key}`;
    // Replace all occurrences of the placeholder with the actual value
    modifiedContent = modifiedContent.replace(
      new RegExp(placeholder, "g"),
      value
    );
  }

  return modifiedContent;
};

const sendTestEmail = async ({
  companyId,
  sourceEmailAddress,
  toEmailAddresses,
  emailSubject,
  templateId,
}) => {
  const promises = [];

  const emailAdresses = toEmailAddresses
    .split(",")
    .map((email) => email.trim());

  const template = await Template.findById(templateId);

  for (const address of emailAdresses) {
    promises.push(
      mapDynamicValues({
        companyId,
        emailAddress: address,
        content: template.body,
      })
    );
  }

  const mappedContentArray = await Promise.all(promises);

  promises.length = 0;

  emailAdresses.forEach((item, index) => {
    promises.push(
      sendEmail({
        fromEmailAddress: sourceEmailAddress,
        toEmailAddress: item,
        subject: emailSubject,
        content: mappedContentArray[index],
      })
    );
  });

  await Promise.all(promises);
};

module.exports = {
  createCampaign,
  readCampaign,
  readAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendTestEmail,
};
