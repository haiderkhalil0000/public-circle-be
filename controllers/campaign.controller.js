const moment = require("moment");
const createHttpError = require("http-errors");

const { Campaign, Template, CompanyUser, Segment } = require("../models");
const {
  basicUtil,
  sesUtil,
  constants: { DOCUMENT_STATUS, RESPONSE_MESSAGES, CRON_STATUS },
} = require("../utils");

const createCampaign = async ({
  companyId,
  segments = [],
  sourceEmailAddress,
  emailSubject,
  emailTemplate = "",
  runMode,
  runSchedule,
  isRecurring,
  recurringPeriod,
}) => {
  basicUtil.validateObjectId({ inputString: emailTemplate });

  const temp = [];

  for (const segment of segments) {
    temp.push(basicUtil.validateObjectId({ inputString: segment }));
  }

  segments = temp;

  const existingCampaign = await Campaign.findOne({
    segments,
    companyId,
  });

  if (existingCampaign) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_CAMPAIGN,
    });
  }

  Campaign.create({
    companyId,
    segments,
    sourceEmailAddress,
    emailSubject,
    emailTemplate,
    runMode,
    runSchedule,
    isRecurring,
    recurringPeriod,
  });
};

const readCampaign = async ({ campaignId = "" }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    throw createHttpError(404, {
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
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.NO_CAMPAIGNS,
    });
  }

  return {
    totalRecords,
    allCampaigns,
  };
};

const updateCampaign = async ({ campaignId = "", campaignData }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const result = await Campaign.updateOne(
    { _id: campaignId },
    { ...campaignData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_UPDATED_ALREADY,
    });
  }
};

const deleteCampaign = async ({ campaignId = "" }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const result = await Campaign.updateOne(
    { _id: campaignId, status: DOCUMENT_STATUS.ACTIVE },
    {
      status: DOCUMENT_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
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
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_NOT_FOUND_IN_COMPANY,
    });
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

  const emailAddresses = toEmailAddresses
    .split(",")
    .map((email) => email.trim());

  const template = await Template.findById(templateId);

  for (const address of emailAddresses) {
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

  emailAddresses.forEach((item, index) => {
    promises.push(
      sesUtil.sendEmail({
        fromEmailAddress: sourceEmailAddress,
        toEmailAddress: item,
        subject: emailSubject,
        content: mappedContentArray[index],
      })
    );
  });

  await Promise.all(promises);
};

const runCampaign = async ({ campaign }) => {
  const promises = [];
  const segmentPromises = [];

  await Campaign.updateOne(
    { _id: campaign._id },
    { cronStatus: CRON_STATUS.PROCESSING }
  );

  for (const segment of campaign.segments) {
    segmentPromises.push(Segment.findById(segment));
  }

  const [segments, template] = await Promise.all([
    Promise.all(segmentPromises),
    Template.findById({ _id: campaign.emailTemplate }),
  ]);

  let allFilters = {};

  for (const segment of segments) {
    allFilters = { ...allFilters, ...segment.filters };
  }

  const emailAddresses = await CompanyUser.find(
    { ...allFilters, companyId: campaign.companyId },
    {
      email: 1,
    }
  ).lean();

  for (const address of emailAddresses) {
    promises.push(
      mapDynamicValues({
        companyId: campaign.companyId,
        emailAddress: address.email,
        content: template.body,
      })
    );
  }

  const mappedContentArray = await Promise.all(promises);

  promises.length = 0;

  emailAddresses.forEach((item, index) => {
    promises.push(
      sesUtil.sendEmail({
        fromEmailAddress: campaign.sourceEmailAddress,
        toEmailAddress: item.email,
        subject: campaign.emailSubject,
        content: mappedContentArray[index],
      })
    );
  });

  await Promise.all(promises);
  await Campaign.updateOne(
    { _id: campaign._id },
    {
      cronStatus: CRON_STATUS.PROCESSED,
      lastProcessed: moment().format(),
      $inc: { processedCount: 1 },
    }
  );
};

module.exports = {
  createCampaign,
  readCampaign,
  readAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendTestEmail,
  runCampaign,
};
