const moment = require("moment");
const createHttpError = require("http-errors");

const {
  Campaign,
  Template,
  CompanyContact,
  Segment,
  Configuration,
  EmailSent,
  CampaignRun,
  Company,
  Plan,
  OverageConsumption,
} = require("../models");
const {
  basicUtil,
  sesUtil,
  constants: {
    MODELS: { CAMPAIGN },
    CAMPAIGN_STATUS,
    RESPONSE_MESSAGES,
    CRON_STATUS,
    RUN_MODE,
    TEMPLATE_CONTENT_TYPE,
    EMAIL_KIND,
    OVERAGE_KIND,
  },
} = require("../utils");

const { PUBLIC_CIRCLES_EMAIL_ADDRESS } = process.env;

const validateSourceEmailAddress = async ({
  companyId,
  sourceEmailAddress,
}) => {
  const configurationDoc = await Configuration.findOne({
    company: companyId,
  }).lean();

  const verifiedEmailOrDomains = [];

  verifiedEmailOrDomains.push(
    configurationDoc.emailConfigurations.addresses.find(
      (item) => item.emailAddress === sourceEmailAddress && item.isVerified
    )
  );

  verifiedEmailOrDomains.push(
    configurationDoc.emailConfigurations.domains.find((domain) => {
      return domain.addresses.find((address) => {
        if (
          address.emailAddress === sourceEmailAddress &&
          address.status === "ACTIVE"
        ) {
          return address.emailAddress;
        }
      });
    })
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

  const usersController = require("./users.controller");
  const companiesController = require("./companies.controller");

  const [campaign, company, primaryUser] = await Promise.all([
    Campaign.create({
      company: companyId,
      segments: segmentIds,
      sourceEmailAddress,
      emailSubject,
      emailTemplate: emailTemplateId,
      runMode,
      runSchedule,
      isRecurring,
      recurringPeriod,
    }),
    companiesController.readCompanyById({ companyId }),
    usersController.readPrimaryUserByCompanyId({ companyId }),
  ]);

  if (runMode === RUN_MODE.INSTANT) {
    await validateCampaign({ campaign, company, primaryUser });
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
  const query = {
    company: companyId,
    status: { $ne: CAMPAIGN_STATUS.DELETED },
  };

  const [totalRecords, allCampaigns] = await Promise.all([
    Campaign.countDocuments(query),
    Campaign.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .populate("segments")
      .lean(),
  ]);

  const companyContactsController = require("./company-contacts.controller");
  const promises = [];
  const usersCountMap = new Map();

  for (const campaign of allCampaigns) {
    usersCountMap.set(campaign._id.toString(), 0); // Initialize `usersCount` for each campaign
    for (const segment of campaign.segments) {
      promises.push(
        companyContactsController
          .readFiltersCount({ filters: segment.filters, companyId })
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

  return {
    totalRecords,
    allCampaigns,
  };
};

const readAllCampaigns = async ({ companyId }) => {
  const allCampaigns = await Campaign.find({
    company: companyId,
    status: { $ne: CAMPAIGN_STATUS.DELETED },
  })
    .populate("segments")
    .lean();

  const companyContactsController = require("./company-contacts.controller");
  const promises = [];
  const usersCountMap = new Map();

  for (const campaign of allCampaigns) {
    usersCountMap.set(campaign._id.toString(), 0);
    for (const segment of campaign.segments) {
      promises.push(
        companyContactsController
          .readFiltersCount({ filters: segment.filters, companyId })
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

const updateCampaign = async ({ companyId, campaignId, campaignData }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const usersController = require("./users.controller");

  let [campaign, company, primaryUser] = await Promise.all([
    Campaign.findById(campaignId),
    Company.findById(companyId),
    usersController.readPrimaryUserByCompanyId({ companyId }),
  ]);

  if (campaignData.segmentIds || campaignData.emailTemplateId) {
    basicUtil.validateObjectId({ inputString: campaignData.emailTemplateId });

    campaignData.segmentIds.forEach((item) => {
      basicUtil.validateObjectId({ inputString: item });
    });

    campaignData.segments = campaignData.segmentIds;
    campaignData.emailTemplate = campaignData.emailTemplateId;

    delete campaignData.segmentIds;
    delete campaignData.emailTemplateId;
  }

  if (campaignData.runMode) {
    campaignData.cronStatus = CRON_STATUS.PENDING;
    campaignData.processedCount = 0;

    campaignData.history = campaign.history;

    campaignData.history.push({
      oldRunMode: campaign.runMode,
      newRunMode: campaignData.runMode,
      oldProcessedCount: campaign.processedCount,
      newProcessedCount: campaignData.processedCount,
    });
  }

  Object.assign(campaign, campaignData);

  await campaign.save();

  if (campaignData.runMode === RUN_MODE.INSTANT) {
    await validateCampaign({ campaign, company, primaryUser });
    await runCampaign({ campaign });
  }
};

const deleteCampaign = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const result = await Campaign.updateOne(
    { _id: campaignId },
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
  const companyData = await CompanyContact.findOne({
    company: companyId,
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
}) => {
  const promises = [];

  const emailAddresses = toEmailAddresses
    .split(",")
    .map((email) => email.trim());

  const emailTemplate = await Template.findById(emailTemplateId);

  for (const address of emailAddresses) {
    promises.push(
      mapDynamicValues({
        companyId,
        emailAddress: address,
        content: emailTemplate.body,
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
        contentType: TEMPLATE_CONTENT_TYPE.HTML,
      })
    );
  });

  const result = await Promise.all(promises);

  promises.length = 0;

  result.forEach((item, index) => {
    promises.push(
      EmailSent.create({
        company: companyId,
        kind: EMAIL_KIND.TEST,
        fromEmailAddress: sourceEmailAddress,
        toEmailAddress: emailAddresses[index],
        emailSubject,
        emailContent: mappedContentArray[index],
        sesMessageId: item.MessageId,
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

  // Flatten all keys in `allFilters`
  for (const key in allFilters) {
    allFilters[key] = allFilters[key].flat();
  }

  // Process each key to apply $in or keep a single value
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

  const [_, campaignRunDoc] = await Promise.all([
    Campaign.updateOne(
      { _id: campaign._id },
      { cronStatus: CRON_STATUS.PROCESSING }
    ),
    CampaignRun.create({
      company: campaign.company,
      campaign: campaign._id,
    }),
  ]);

  for (const segment of campaign.segments) {
    segmentPromises.push(Segment.findById(segment));
  }

  const queryArray = [Promise.all(segmentPromises)];

  queryArray.push(Template.findById({ _id: campaign.emailTemplate }));

  const [segments, template] = await Promise.all(queryArray);

  const query = populateCompanyUserQuery({ segments });

  let emailAddresses = await CompanyContact.find(
    { ...query, company: campaign.company },
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
        companyId: campaign.company,
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
        contentType: TEMPLATE_CONTENT_TYPE.HTML,
      })
    );
  });

  const result = await Promise.all(promises);

  promises.length = 0;

  result.forEach((item, index) => {
    promises.push(
      EmailSent.create({
        company: campaign.company,
        campaign: campaign._id,
        campaignRun: campaignRunDoc._id,
        kind: EMAIL_KIND.REGULAR,
        fromEmailAddress: campaign.sourceEmailAddress,
        toEmailAddress: emailAddresses[index],
        emailSubject: campaign.emailSubject,
        emailContent: mappedContentArray[index],
        size: template.size,
        sesMessageId: item.MessageId,
      })
    );
  });

  promises.push(
    Campaign.updateOne(
      { _id: campaign._id },
      {
        cronStatus: CRON_STATUS.PROCESSED,
        lastProcessed: moment().format(),
        $inc: { processedCount: 1 },
      }
    )
  );

  await Promise.all(promises);
};

const readPaginatedCampaignLogs = async ({
  companyId,
  pageNumber,
  pageSize,
}) => {
  const query = {
    company: companyId,
    processedCount: { $gte: 1 },
  };

  const [totalRecords, campaignDocs] = await Promise.all([
    Campaign.countDocuments(query),
    Campaign.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .populate("segments")
      .lean(),
  ]);

  const promises = [];

  campaignDocs.forEach((item) => {
    promises.push(CampaignRun.countDocuments({ campaign: item._id }));
  });

  const campaignRunCountDocs = await Promise.all(promises);

  campaignDocs.forEach((item, index) => {
    item.totalRuns = campaignRunCountDocs[index];
  });

  promises.length = 0;

  const companyContactsController = require("./company-contacts.controller");

  await Promise.all(
    campaignDocs.map(async (campaign) => {
      let totalUsersCount = 0;
      await Promise.all(
        campaign.segments.map(async (segment) => {
          const result = await companyContactsController.readFiltersCount({
            companyId: campaign.company,
            filters: segment.filters,
          });

          if (Array.isArray(result)) {
            totalUsersCount += result.reduce(
              (sum, item) => sum + item.filterCount,
              0
            );
          }

          campaign.usersCount = totalUsersCount;
        })
      );
    })
  );

  return { totalRecords, campaignLogs: campaignDocs };
};

const readAllCampaignLogs = ({ pageNumber, pageSize, companyId }) =>
  EmailSent.find({ company: companyId })
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(pageSize)
    .populate("company")
    .populate(CAMPAIGN);

const readCampaignRecipientsCount = async ({ campaign }) => {
  const companyContactsController = require("./company-contacts.controller");

  const { segments } = await Campaign.findById(campaign._id).populate(
    "segments",
    "filters"
  );

  const filters = segments.map((item) => item.filters);

  const promises = [];

  filters.forEach((filter) => {
    promises.push(
      companyContactsController.readFilterCount({
        filter,
        companyId: campaign.company,
      })
    );
  });

  let filterCounts = await Promise.all(promises);

  return filterCounts.reduce((total, current) => total + current);
};

const calculateExtraEmailQuotaAndCharge = ({ unpaidEmailsCount, plan }) => {
  const { emails, price } = plan.bundles.email;

  const timesExceeded = Math.ceil(unpaidEmailsCount / emails);

  return {
    extraEmailQuota: timesExceeded * emails,
    extraEmailCharge: timesExceeded * price,
  };
};

const calculateEmailContentQuotaAndCharge = ({ unpaidEmailContent, plan }) => {
  const { bandwidth, price } = plan.bundles.emailContent;

  const timesExceeded = Math.ceil(unpaidEmailContent / bandwidth);

  return {
    extraEmailContentQuota: timesExceeded * bandwidth,
    extraEmailContentCharge: timesExceeded * price,
  };
};

const disableCampaign = ({ campaignId }) =>
  Campaign.findByIdAndUpdate(campaignId, { status: CAMPAIGN_STATUS.DISABLED });

const getDescription = ({ extraEmailCharge, extraEmailContentCharge }) => {
  if (extraEmailCharge && extraEmailContentCharge) {
    return `Consumed balance over extra email overage + email content overage.`;
  } else if (extraEmailCharge) {
    return `Consumed balance over extra email overage.`;
  } else {
    return `Consumed balance over extra email content overage.`;
  }
};

const validateCampaign = async ({ campaign, company, primaryUser }) => {
  const stripeController = require("./stripe.controller");
  //adding email template details in the campaign parameter
  campaign = await Campaign.findById(campaign._id).populate("emailTemplate");

  const [campaignRecipientsCount, activeBillingCycleDates] = await Promise.all([
    readCampaignRecipientsCount({
      campaign,
    }),
    stripeController.readActiveBillingCycleDates({
      stripeCustomerId: company.stripeCustomerId,
    }),
  ]);

  const billingCycleStartDate = activeBillingCycleDates.startDate;
  const billingCycleEndDate = activeBillingCycleDates.endDate;

  const emailsSentByCompany = await EmailSent.find(
    {
      company: campaign.company,
      createdAt: {
        $gte: billingCycleStartDate,
        $lt: billingCycleEndDate,
      },
    },
    {
      size: 1,
    }
  );

  let emailContentSentByCompany = emailsSentByCompany
    .map((item) => item.size)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const overageConsumptionController = require("./overage-consumption.controller");

  let [companyBalance, emailOverageDocs, emailContentOverageDocs, planIds] =
    await Promise.all([
      stripeController.readCustomerBalance({
        companyId: campaign.company,
      }),
      overageConsumptionController.readEmailOverage({
        companyId: company._id,
        billingCycleStartDate,
        billingCycleEndDate,
      }),
      overageConsumptionController.readEmailContentOverage({
        companyId: company._id,
        billingCycleStartDate,
        billingCycleEndDate,
      }),
      stripeController.readPlanIds({
        stripeCustomerId: company.stripeCustomerId,
      }),
    ]);

  const plan = await Plan.findById(planIds[0].planId);

  const companyExtraEmailQuota = emailOverageDocs
    .map((item) => item.overageCount)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const companyExtraEmailContentQuota = emailContentOverageDocs
    .map((item) => item.overageCount)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  let extraEmailCharge = 0,
    extraEmailQuota = 0,
    extraEmailContentCharge = 0;
  extraEmailContentQuota = 0;

  if (
    plan.quota.email + companyExtraEmailQuota <
    campaignRecipientsCount + emailsSentByCompany.length
  ) {
    const totalEmailsCount =
      campaignRecipientsCount + emailsSentByCompany.length; // emails to be sent + emails already sent

    const totalPaidEmailsCount = plan.quota.email + companyExtraEmailQuota; // emails from plan + emails from extra purchase

    const unpaidEmailsCount = totalEmailsCount - totalPaidEmailsCount;

    const result = calculateExtraEmailQuotaAndCharge({
      unpaidEmailsCount,
      companyExtraEmailQuota,
      plan,
    });

    extraEmailQuota = result.extraEmailQuota;
    extraEmailCharge = result.extraEmailCharge;

    if (companyBalance < extraEmailCharge) {
      await disableCampaign({ campaignId: campaign._id });

      await sesUtil.sendEmail({
        fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
        toEmailAddress: primaryUser.emailAddress,
        subject: RESPONSE_MESSAGES.EMAIL_LIMIT_REACHED,
        content: `Dear ${primaryUser.firstName},
        We have restricted your campaign from running because you don't have enough credits to pay for
        the new campaign. As your quota for ${plan.name} is fully consumed. So we recommend you to top-up
        into your account by visiting the link below and try again.

        https://publiccircles.netlify.app/dashboard/subscription
        `,
        contentType: TEMPLATE_CONTENT_TYPE.TEXT,
      });

      throw createHttpError(400, {
        errorMessage: RESPONSE_MESSAGES.EMAIL_LIMIT_REACHED,
      });
    }
  }

  if (
    plan.quota.emailContent + companyExtraEmailContentQuota <
    emailContentSentByCompany +
      campaign.emailTemplate.size * campaignRecipientsCount
  ) {
    const totalEmailContentCount =
      campaign.emailTemplate.size * campaignRecipientsCount +
      emailContentSentByCompany;

    const totalPaidEmailContentCount =
      plan.quota.emailContent + companyExtraEmailContentQuota;

    const unpaidEmailContent =
      totalEmailContentCount - totalPaidEmailContentCount;

    result = calculateEmailContentQuotaAndCharge({
      unpaidEmailContent,
      companyExtraEmailContentQuota,
      plan,
    });

    extraEmailContentQuota = result.extraEmailContentQuota;
    extraEmailContentCharge = result.extraEmailContentCharge;

    if (companyBalance < extraEmailContentCharge) {
      await disableCampaign({ campaignId: campaign._id });

      await sesUtil.sendEmail({
        fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
        toEmailAddress: primaryUser.emailAddress,
        subject: RESPONSE_MESSAGES.EMAIL_CONTENT_LIMIT_REACHED,
        content: `Dear ${primaryUser.firstName},
        We have restricted your campaign from running because you don't have enough credits to pay for
        the new campaign. As your quota for ${plan.name} is fully consumed. So we recommend you to top-up
        into your account by visiting the link below and try again.

        https://publiccircles.netlify.app/dashboard/subscription
        `,
        contentType: TEMPLATE_CONTENT_TYPE.TEXT,
      });

      throw createHttpError(400, {
        errorMessage: RESPONSE_MESSAGES.EMAIL_CONTENT_LIMIT_REACHED,
      });
    }
  }

  if (extraEmailCharge || extraEmailContentCharge) {
    const promises = [];

    if (extraEmailCharge) {
      promises.push(
        OverageConsumption.create({
          company: company._id,
          stripeCustomerId: company.stripeCustomerId,
          description: getDescription({
            extraEmailCharge,
          }),
          overageCount: extraEmailQuota,
          overagePrice: extraEmailCharge,
          kind: OVERAGE_KIND.EMAIL,
        })
      );

      companyBalance = companyBalance - extraEmailCharge;
    }

    if (extraEmailContentCharge) {
      promises.push(
        OverageConsumption.create({
          company: company._id,
          stripeCustomerId: company.stripeCustomerId,
          description: getDescription({
            extraEmailContentCharge,
          }),
          overageCount: extraEmailContentQuota,
          overagePrice: extraEmailContentCharge,
          kind: OVERAGE_KIND.BANDWIDTH,
        })
      );

      companyBalance = companyBalance - extraEmailContentCharge;
    }

    await Promise.all(promises);
  }
};

const getCampaignBandwidthUsage = ({ emailSentDocsArray }) =>
  emailSentDocsArray
    .map((item) => item.size)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

const readCampaignUsageDetails = async ({ companyId }) => {
  const campaignIds = await Campaign.distinct("_id", { company: companyId });

  const promises = [];

  const emailSentController = require("./emails-sent.controller");

  campaignIds.forEach((campaignId) => {
    promises.push(
      emailSentController.readEmailsSentByCampaignId({
        campaignId,
      })
    );
  });

  const emailsSentByCompany = await Promise.all(promises);

  return campaignIds.map((campaignId, index) => ({
    campaignId,
    emailUsage: emailsSentByCompany[index].length,
    bandwidthUsage: getCampaignBandwidthUsage({
      emailSentDocsArray: emailsSentByCompany[index],
    }),
    bandwidthUnit: basicUtil
      .calculateByteUnit({
        bytes: getCampaignBandwidthUsage({
          emailSentDocsArray: emailsSentByCompany[index],
        }),
      })
      .split(" ")[1],
  }));
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
  readPaginatedCampaignLogs,
  readAllCampaignLogs,
  readCampaignRecipientsCount,
  validateCampaign,
  readCampaignUsageDetails,
};
