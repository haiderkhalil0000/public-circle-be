const moment = require("moment");
const createHttpError = require("http-errors");

const {
  Campaign,
  Template,
  CompanyUser,
  Segment,
  Configuration,
  EmailSent,
  DynamicTemplate,
} = require("../models");
const {
  basicUtil,
  sesUtil,
  constants: { CAMPAIGN_STATUS, RESPONSE_MESSAGES, CRON_STATUS, RUN_MODE },
} = require("../utils");

const validateSourceEmailAddress = async ({
  companyId,
  sourceEmailAddress,
}) => {
  const configurationDoc = await Configuration.findOne({ companyId }).lean();

  const verifiedEmailOrDomains = [];

  verifiedEmailOrDomains.push(
    configurationDoc.emailConfigurations.addresses.find(
      (item) => item.emailAddress === sourceEmailAddress && item.isVerified
    )
  );

  verifiedEmailOrDomains.push(
    configurationDoc.emailConfigurations.domains.forEach(
      (item) => item.emailAddress === sourceEmailAddress && item.isVerified
    )
  );

  if (!verifiedEmailOrDomains.filter(Boolean).length) {
    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_NOT_VERIFIED,
    });
  }
};

const createCampaign = async ({
  companyId,
  segmentIds = [],
  sourceEmailAddress,
  emailSubject,
  emailTemplateId,
  dynamicEmailTemplateId,
  runMode,
  runSchedule,
  isRecurring,
  recurringPeriod,
}) => {
  await validateSourceEmailAddress({
    companyId,
    sourceEmailAddress,
  });
  basicUtil.validateObjectId({ inputString: emailTemplateId });

  for (const segmentId of segmentIds) {
    basicUtil.validateObjectId({ inputString: segmentId });
  }

  const campaign = await Campaign.create({
    company: companyId,
    segments: segmentIds,
    sourceEmailAddress,
    emailSubject,
    emailTemplate: emailTemplateId,
    dynamicEmailTemplate: dynamicEmailTemplateId,
    runMode,
    runSchedule,
    isRecurring,
    recurringPeriod,
  });

  if (runMode === RUN_MODE.INSTANT) {
    await runCampaign({ campaign });
  }
};

const readCampaign = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  return campaign;
};

const readPaginatedCampaigns = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const query = { company: companyId, status: CAMPAIGN_STATUS.ACTIVE };

  const [totalRecords, allCampaigns] = await Promise.all([
    Campaign.countDocuments(query),
    Campaign.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    allCampaigns,
  };
};

const readAllCampaigns = async ({ companyId }) => {
  const allCampaigns = await Campaign.find({
    company: companyId,
    status: CAMPAIGN_STATUS.ACTIVE,
  })
    .populate("segments")
    .lean();

  const companyUsersController = require("./company-users.controller");
  const promises = [];
  const usersCountMap = new Map();

  for (const campaign of allCampaigns) {
    usersCountMap.set(campaign._id.toString(), 0); // Initialize `usersCount` for each campaign
    for (const segment of campaign.segments) {
      promises.push(
        companyUsersController
          .getFiltersCount({ filters: segment.filters })
          .then((item) => ({
            campaignId: campaign._id.toString(),
            usersCount: item[0].filterCount,
          }))
      );
    }
  }

  const segmentUsersCount = await Promise.all(promises);

  // Use the Map to aggregate `usersCount` for each campaign
  segmentUsersCount.forEach((item) => {
    usersCountMap.set(
      item.campaignId,
      usersCountMap.get(item.campaignId) + item.usersCount
    );
  });

  // Attach aggregated `usersCount` from the Map to the campaigns
  allCampaigns.forEach((campaign) => {
    campaign.usersCount = usersCountMap.get(campaign._id.toString());
  });

  return allCampaigns;
};

const updateCampaign = async ({ campaignId, campaignData }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  if (
    campaignData.segmentIds ||
    campaignData.emailTemplateId ||
    campaignData.dynamicEmailTemplateId
  ) {
    if (campaignData.dynamicEmailTemplateId) {
      basicUtil.validateObjectId({ inputString: dynamicEmailTemplateId });
    }

    campaignData.segments = campaignData.segmentIds;
    campaignData.emailTemplate = campaignData.emailTemplateId;
    campaignData.dynamicEmailTemplate = campaignData.dynamicEmailTemplateId;

    delete campaignData.segmentIds;
    delete campaignData.emailTemplateId;
    delete campaignData.dynamicEmailTemplateId;
  }

  const result = await Campaign.updateOne(
    { _id: campaignId },
    { ...campaignData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }
};

const deleteCampaign = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const result = await Campaign.updateOne(
    { _id: campaignId, status: CAMPAIGN_STATUS.ACTIVE },
    {
      status: CAMPAIGN_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
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

  let modifiedContent = content;

  for (const [key, value] of Object.entries(companyData)) {
    const placeholder = `{{${key}}}`;

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
  emailTemplateId,
  dynamicEmailTemplateId,
}) => {
  const promises = [];

  const emailAddresses = toEmailAddresses
    .split(",")
    .map((email) => email.trim());

  let dynamicEmailTemplate, emailTemplate;

  if (dynamicEmailTemplateId) {
    dynamicEmailTemplate = await DynamicTemplate.findById(
      dynamicEmailTemplateId
    );
  } else {
    emailTemplate = await Template.findById(emailTemplateId);
  }

  for (const address of emailAddresses) {
    promises.push(
      mapDynamicValues({
        companyId,
        emailAddress: address,
        content: dynamicEmailTemplateId
          ? dynamicEmailTemplate.body
          : emailTemplate.body,
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
        contentType: emailTemplate.kind,
      })
    );
  });

  await Promise.all(promises);
};

const populateCompanyUserQuery = ({ segments }) => {
  let allFilters = {};

  for (const segment of segments) {
    for (const [key, value] of Object.entries(segment.filters)) {
      if (!allFilters[key]) {
        allFilters[key] = [];
      }
      allFilters[key].push(value);
    }
  }

  for (const key in allFilters) {
    if (allFilters[key].length > 1) {
      allFilters[key] = { $in: allFilters[key] };
    } else {
      allFilters[key] = allFilters[key][0];
    }
  }

  return allFilters;
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

  const queryArray = [Promise.all(segmentPromises)];

  if (campaign.dynamicEmailTemplateId) {
    queryArray.push(
      DynamicTemplate.findById({ _id: campaign.dynamicEmailTemplate })
    );
  } else {
    queryArray.push(Template.findById({ _id: campaign.emailTemplate }));
  }

  const [segments, template] = await Promise.all(queryArray);

  const query = populateCompanyUserQuery({ segments });

  let emailAddresses = await CompanyUser.find(
    { ...query, companyId: campaign.companyId },
    {
      email: 1,
    }
  ).lean();

  emailAddresses = basicUtil.fiterUniqueStringsFromArray(
    emailAddresses.map((item) => item.email)
  );

  for (const address of emailAddresses) {
    promises.push(
      mapDynamicValues({
        companyId: campaign.companyId,
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
        fromEmailAddress: campaign.sourceEmailAddress,
        toEmailAddress: item,
        subject: campaign.emailSubject,
        content: mappedContentArray[index],
        contentType: template.kind,
      })
    );
  });

  const result = await Promise.all(promises);

  promises.length = 0;

  result.forEach((item, index) => {
    promises.push(
      EmailSent.create({
        companyId: campaign.companyId,
        fromEmailAddress: campaign.sourceEmailAddress,
        toEmailAddress: emailAddresses[index],
        emailSubject: campaign.emailSubject,
        emailContent: mappedContentArray[index],
        sesMessageId: item.MessageId,
      })
    );
  });

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
  readPaginatedCampaigns,
  readAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendTestEmail,
  runCampaign,
};
