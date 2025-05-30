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
  User,
  CompanyGrouping,
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
    SORT_ORDER,
    COMPANY_CONTACT_STATUS,
    CAMPAIGN_FREQUENCIES,
  },
} = require("../utils");
const {
  REGIONS,
  POWERED_BY,
  COMPANY_GROUPING_TYPES,
} = require("../utils/constants.util");
const { default: axios } = require("axios");
const shortid = require("shortid");

const {
  PUBLIC_CIRCLES_EMAIL_ADDRESS,
  PUBLIC_CIRCLES_WEB_URL,
  PUBLIC_CIRCLE_ADD_ON_ID,
} = process.env;

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
  emailAddress,
  segmentIds = [],
  sourceEmailAddress,
  emailSubject,
  emailTemplateId,
  runMode,
  runSchedule,
  isRecurring,
  isOnGoing,
  recurringPeriod,
  frequency,
  status,
  campaignCompanyId,
  campaignName,
  companyGroupingId,
}) => {
  if (status !== CAMPAIGN_STATUS.PAUSED) {
    for (const segmentId of segmentIds) {
      basicUtil.validateObjectId({ inputString: segmentId });
    }
  }
  basicUtil.validateObjectId({ inputString: companyGroupingId });

  const companyGroupingDoc = await CompanyGrouping.findOne({
    _id: companyGroupingId,
    companyId,
    type: COMPANY_GROUPING_TYPES.CAMPAIGN,
  }).lean();

  if (!companyGroupingDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_GROUPING_NOT_FOUND,
    });
  }
  if (!campaignCompanyId) {
    campaignCompanyId = shortid.generate();
  }

  await validateSourceEmailAddress({
    companyId,
    sourceEmailAddress,
  });
  await validateCampaignCompanyId({ campaignCompanyId, companyId });

  basicUtil.validateObjectId({ inputString: emailTemplateId });

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
      isOnGoing,
      campaignCompanyId,
      recurringPeriod,
      frequency,
      status,
      campaignName,
      companyGroupingId,
    }),
    companiesController.readCompanyById({ companyId }),
    usersController.readPrimaryUserByCompanyId({ companyId }),
    User.findOneAndUpdate(
      { emailAddress },
      {
        $set: {
          "tourSteps.steps.5.isCompleted": true,
        },
      }
    ),
  ]);

  if (campaign.status === CAMPAIGN_STATUS.ACTIVE) {
    await validateCampaign({ campaign, company, primaryUser });

    if (runMode !== RUN_MODE.SCHEDULE) {
      await runCampaign({ campaign });
    }
  }

  return campaign;
};

const readCampaign = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const campaign = await Campaign.findById(campaignId)
    .populate("segments")
    .populate("companyGroupingId")
    .lean();

  if (!campaign) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CAMPAIGN_NOT_FOUND,
    });
  }

  return campaign;
};

const readSegmentPopulatedCampaign = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const campaign = await Campaign.findById(campaignId)
    .populate("segments")
    .lean();

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
  sortBy,
  sortOrder = SORT_ORDER.ASC,
  companyGroupingIds,
}) => {
  const query = {
    company: companyId,
    status: { $ne: CAMPAIGN_STATUS.DELETED },
  };

  if (companyGroupingIds) {
    const idsArray = companyGroupingIds.split(",").map((id) => id.trim());
    idsArray.forEach((id) => {
      basicUtil.validateObjectId({ inputString: id });
    });
    query.companyGroupingId = { $in: idsArray };
  }

  const [totalRecords, allCampaigns] = await Promise.all([
    Campaign.countDocuments(query),
    Campaign.find(query)
      .sort({ [sortBy]: sortOrder === SORT_ORDER.ASC ? 1 : -1 })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .populate("segments")
      .populate("companyGroupingId")
      .lean(),
  ]);

  for (const campaign of allCampaigns) {
    const query = buildCombinedQueryFromSegments({
      segments: campaign.segments,
      companyId: campaign.company,
    });
    campaign.usersCount = await CompanyContact.countDocuments(query);
  }
  return {
    totalRecords,
    allCampaigns,
  };
};

const readAllCampaigns = async ({
  companyId,
  sortBy,
  sortOrder = SORT_ORDER.ASC,
}) => {
  const allCampaigns = await Campaign.find({
    company: companyId,
    status: { $ne: CAMPAIGN_STATUS.DELETED },
  })
    .sort({ [sortBy]: sortOrder === SORT_ORDER.ASC ? 1 : -1 })
    .populate("segments")
    .lean();

  for (const campaign of allCampaigns) {
    const query = buildCombinedQueryFromSegments({
      segments: campaign.segments,
      companyId: campaign.company,
    });
    campaign.usersCount = await CompanyContact.countDocuments(query);
  }
  return allCampaigns;
};

const updateCampaign = async ({ companyId, campaignId, campaignData }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  if (campaignData.companyGroupingId) {
    basicUtil.validateObjectId({ inputString: campaignData.companyGroupingId });
    const companyGroupingDoc = await CompanyGrouping.findOne({
      _id: campaignData.companyGroupingId,
      companyId,
      type: COMPANY_GROUPING_TYPES.CAMPAIGN,
    }).lean();

    if (!companyGroupingDoc) {
      throw createHttpError(404, {
        errorMessage: RESPONSE_MESSAGES.COMPANY_GROUPING_NOT_FOUND,
      });
    }
  }
  const usersController = require("./users.controller");

  let [campaign, company, primaryUser] = await Promise.all([
    Campaign.findById(campaignId),
    Company.findById(companyId),
    usersController.readPrimaryUserByCompanyId({ companyId }),
  ]);
  await validateCampaignCompanyId({
    campaignCompanyId: campaign.campaignCompanyId,
    companyId,
    isUpdate: true,
  });
  if (!campaignData.campaignCompanyId) {
    campaignData.campaignCompanyId = shortid.generate();
  }

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

  campaign = await Campaign.findByIdAndUpdate(campaign._id, campaignData, {
    new: true,
  });

  if (
    campaign.status === CAMPAIGN_STATUS.ACTIVE ||
    campaignData.status === CAMPAIGN_STATUS.ACTIVE
  ) {
    await validateCampaign({ campaign, company, primaryUser });

    if (campaign.runMode === RUN_MODE.INSTANT) {
      await runCampaign({ campaign });
    }
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
  let companyContactDoc = await CompanyContact.findOne({
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    email: emailAddress,
  }).lean();

  const companyDoc = await Company.findOne({
    _id: companyId,
  });

  const hasPurchasedPublicCircleAddon = companyDoc.purchasedPlan.some(
    (plan) => plan.productId === PUBLIC_CIRCLE_ADD_ON_ID
  );

  if (!companyContactDoc) {
    companyContactDoc = await CompanyContact.findOne({
      public_circles_company: companyId,
      public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    }).lean();
  }

  if (!companyContactDoc) {
    return content;
  }
  let modifiedContent = content;
  const unSubscribeLink = `${PUBLIC_CIRCLES_WEB_URL}/un-sub?ccid=${companyContactDoc._id}`;
  modifiedContent = modifiedContent.replace(
    new RegExp("{{UNSUBSCRIBE_LINK}}", "g"),
    unSubscribeLink
  );
  for (const [key, value] of Object.entries(companyContactDoc)) {
    const placeholder = `{{${key}}}`;

    modifiedContent = modifiedContent.replace(
      new RegExp(placeholder, "g"),
      value
    );
  }

  // Will have to update this code
  
  // if (!hasPurchasedPublicCircleAddon) {
  //   const CLASS_NAME = POWERED_BY.COMMON_CLASS_NAME;
  //   const partialHTML = POWERED_BY.POWERED_BY_PARTIAL_HTML;
  //   const fullHTML = POWERED_BY.POWERED_BY_FULL_HTML;

  //   if (modifiedContent.includes(`class="${CLASS_NAME}"`)) {
  //     modifiedContent = modifiedContent.replace(
  //       /(<div class="unsubscribe-section"[^>]*>\s*<span>\s*)(<a[\s\S]*?Unsubscribe)/,
  //       `$1${partialHTML}$2`
  //     );
  //   } else {
  //     modifiedContent = modifiedContent.replace(
  //       /<\/body>/i,
  //       `${fullHTML}</body>`
  //     );
  //   }
  // }
  return modifiedContent;
};

const sendTestEmail = async ({
  companyId,
  campaignId,
  sourceEmailAddress,
  toEmailAddresses,
  emailSubject,
  emailTemplateId,
}) => {
  const promises = [];

  const usersController = require("./users.controller");

  const [campaign, company, primaryUser] = await Promise.all([
    Campaign.findById(campaignId),
    Company.findById(companyId),
    usersController.readPrimaryUserByCompanyId({ companyId }),
  ]);

  await validateCampaign({ campaign, company, primaryUser });

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
        campaign: campaignId,
        kind: EMAIL_KIND.TEST,
        fromEmailAddress: sourceEmailAddress,
        toEmailAddress: emailAddresses[index],
        emailSubject,
        emailContent: mappedContentArray[index],
        size: emailTemplate.size,
        sesMessageId: item.MessageId,
      })
    );
  });

  await Promise.all(promises);
};

const sendSstEmail = async ({
  companyId,
  campaignId,
  campaignRunId,
  kind,
  emailFrom,
  emailTo,
  emailSubject,
  templateId,
  emailContentType,
}) => {
  const template = await Template.findById({ _id: templateId });

  const emailContent = await mapDynamicValues({
    companyId: companyId,
    emailAddress: emailTo,
    content: template.body,
  });
  const result = await sesUtil.sendEmail({
    fromEmailAddress: emailFrom,
    toEmailAddress: emailTo,
    subject: emailSubject,
    content: emailContent,
    contentType: emailContentType,
  });

  EmailSent.create({
    company: companyId,
    campaign: campaignId,
    campaignRun: campaignRunId,
    kind: kind,
    fromEmailAddress: emailFrom,
    toEmailAddress: emailTo,
    emailSubject,
    emailContent: emailContent,
    size: template.size,
    sesMessageId: result.MessageId,
  });
};

const buildCombinedQueryFromSegments = ({segments, companyId}) => {
  const segmentQueries = [];

  segments.forEach(segment => {
    const segmentAndConditions = [];
    const segmentOrConditions = [];

    segment.filters.forEach(filter => {
      if (filter.values && filter.values.length && !filter.conditions?.length) {
        const condition = { [filter.key]: { $in: filter.values } };
        if (filter.operator === "OR") {
          segmentOrConditions.push(condition);
        } else {
          segmentAndConditions.push(condition);
        }
      } else if (filter.conditions && filter.conditions.length) {
        const companyContactsController = require("./company-contacts.controller");
        const filterConditionQueries = companyContactsController.getFilterConditionQuery({
          conditions: filter.conditions,
          conditionKey: filter.key,
        }).filter(c => Object.keys(c).length > 0);

        if (filter.operator === "OR") {
          segmentOrConditions.push(...filterConditionQueries);
        } else {
          segmentAndConditions.push(...filterConditionQueries);
        }
      }
    });
    const segmentQuery = {};

    if (segmentAndConditions.length && segmentOrConditions.length) {
      segmentQuery["$and"] = [
        { $and: segmentAndConditions },
        { $or: segmentOrConditions }
      ];
    } else if (segmentAndConditions.length) {
      if (segmentAndConditions.length === 1) {
        Object.assign(segmentQuery, segmentAndConditions[0]);
      } else {
        segmentQuery["$and"] = segmentAndConditions;
      }
    } else if (segmentOrConditions.length) {
      if (segmentOrConditions.length === 1) {
        Object.assign(segmentQuery, segmentOrConditions[0]);
      } else {
        segmentQuery["$or"] = segmentOrConditions;
      }
    }

    if (Object.keys(segmentQuery).length > 0) {
      segmentQueries.push(segmentQuery);
    }
  });

  const combinedQuery = {
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
  };

  if (segmentQueries.length === 1) {
    Object.assign(combinedQuery, segmentQueries[0]);
  } else if (segmentQueries.length > 1) {
    combinedQuery["$or"] = segmentQueries;
  }

  return combinedQuery;
};


const runCampaign = async ({ campaign }) => {
  const promises = [];
  const segmentPromises = [];
  const frequencyPromises = [];

  promises.push(
    Campaign.updateOne(
      { _id: campaign._id },
      { cronStatus: CRON_STATUS.PROCESSING }
    )
  );

  const campaignRunController = require("./campaigns-run.controller");

  let campaignRunDoc = {};

  if (campaign.isOnGoing) {
    promises.push(
      campaignRunController.readCampaignRunByCampaignId({
        campaignId: campaign._id,
      })
    );

    const [_, existingCampaignRun] = await Promise.all(promises);

    promises.length = 0;

    if (!existingCampaignRun) {
      promises.push(
        campaignRunController.createCampaignRun({
          companyId: campaign.company,
          campaignId: campaign._id,
        })
      );
    } else {
      campaignRunDoc = existingCampaignRun;
    }

    //since campaignRun is existing we will not create another campaignRun for ON_GOING
  } else {
    promises.push(
      campaignRunController.createCampaignRun({
        companyId: campaign.company,
        campaignId: campaign._id,
      })
    );
  }

  const results = await Promise.all(promises);

  if (results[1]) {
    campaignRunDoc = results[1];
  } else if (results[0]) {
    campaignRunDoc = results[0];
  }

  for (const segment of campaign.segments) {
    segmentPromises.push(Segment.findById(segment).lean());
  }

  const segments = await Promise.all(segmentPromises);

  const query = buildCombinedQueryFromSegments({
    segments,
    companyId: campaign.company,
  });
  
  let [emailAddresses, company] = await Promise.all([
    CompanyContact.find(
      query,
      {
        email: 1,
      }
    ),
    Company.findById(campaign.company),
  ]);

  const { emailKey } = company;

  emailAddresses = basicUtil.fiterUniqueStringsFromArray(
    emailAddresses.map((item) => item[emailKey])
  );

  if (campaign.frequency === CAMPAIGN_FREQUENCIES.ONE_TIME) {
    //we will iterate and find each email address document with this campaignId in email-sent collection
    //if any document found we will remove that email address from the emailAddresses array
    const emailsSentController = require("./emails-sent.controller");

    emailAddresses.forEach((emailAddress) => {
      frequencyPromises.push(
        emailsSentController.readEmailSentByCampaignIdAndEmailAdress({
          campaignId: campaign._id,
          emailAddress,
        })
      );
    });

    const results = await Promise.all(frequencyPromises);

    const emailAddressesToBeRemoved = results
      .filter((doc) => doc && doc.toEmailAddress)
      .map((doc) => doc.toEmailAddress);

    emailAddresses = emailAddresses.filter(
      (emailAddress) => !emailAddressesToBeRemoved.includes(emailAddress)
    );
  }

  const reqBody = {
    campaignId: campaign._id,
    companyId: campaign.company,
    campaignRunId: campaignRunDoc._id,
    kind: EMAIL_KIND.REGULAR,
    emailAddresses: emailAddresses,
    emailFrom: campaign.sourceEmailAddress,
    emailSubject: campaign.emailSubject,
    templateId: campaign.emailTemplate,
    emailContentType: TEMPLATE_CONTENT_TYPE.HTML,
  };

  const queueUrl = getQueueUrl();

  await Campaign.updateOne(
    { _id: campaign._id },
    {
      [!campaign.isRecurring && !campaign.isOnGoing ? "status" : undefined]:
        !campaign.isRecurring && !campaign.isOnGoing
          ? CAMPAIGN_STATUS.PAUSED
          : undefined,
      cronStatus: CRON_STATUS.PROCESSED,
      lastProcessed: moment().format(),
      $inc: { processedCount: 1 },
    }
  );
  axios.post(queueUrl, reqBody);
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
      const query = buildCombinedQueryFromSegments({
        segments: campaign.segments,
        companyId: campaign.company,
      });
      campaign.usersCount = await CompanyContact.countDocuments(query);
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
  const { segments } = await Campaign.findById(campaign._id).populate(
    "segments",
    "filters"
  );
  const query = buildCombinedQueryFromSegments({
    segments: segments,
    companyId: campaign.company,
  });
  const filterCounts = await CompanyContact.countDocuments(query);
  return filterCounts;
};

const calculateEmailOverageCharge = ({ unpaidEmailsCount, plan, currency }) => {
  // const { emails } = plan.bundles.email;
  const priceInCents = parseFloat(
    currency === "USD"
      ? plan.bundles.email.priceInSmallestUnitUSD
      : plan.bundles.email.priceInSmallestUnitCAD
  );

  // const timesExceeded = Math.ceil(unpaidEmailsCount / emails);
  const totalCost =  Math.ceil(unpaidEmailsCount * priceInCents * 100);
  return totalCost;
};

const calculateBandwidthOverageCharge = ({
  unpaidBandwidth,
  plan,
  currency,
}) => {
  // const { bandwidth } = plan.bundles.bandwidth;

  const priceInCents = parseFloat(
    currency === "USD"
      ? plan.bundles.bandwidth.priceInSmallestUnitUSD
      : plan.bundles.bandwidth.priceInSmallestUnitCAD
  );
  unpaidBandwidth = unpaidBandwidth / 1000; // Converting to KB
  // const timesExceeded = Math.ceil(unpaidBandwidth / bandwidth);

  const totalCost =  Math.ceil(unpaidBandwidth * priceInCents * 100);
  return totalCost;
};

const draftCampaign = ({ campaignId }) =>
  Campaign.findByIdAndUpdate(campaignId, { status: CAMPAIGN_STATUS.DRAFT });

const validateCampaign = async ({ campaign, company, primaryUser }) => {
  const stripeController = require("./stripe.controller");
  const companyContactsController = require("./company-contacts.controller");

  if (!company.isContactFinalize) {
    await draftCampaign({ campaignId: campaign._id });
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.CONTACTS_ARE_NOT_FINALIZE,
      errorCode: `Campaign created with id ${campaign._id}`,
    });
  }
  if (campaign.isOnGoing) {
    const { totalRecords } =
      await companyContactsController.readCompanyContactDuplicates({
        companyId: campaign.company,
      });

    if (totalRecords) {
      await draftCampaign({ campaignId: campaign._id });

      throw createHttpError(400, {
        errorMessage: RESPONSE_MESSAGES.CONTACT_DUPLICATES_NOT_RESOLVED,
        errorCode: `Campaign created with id ${campaign._id}`,
      });
    }
  }

  if (!company.emailKey) {
    await draftCampaign({ campaignId: campaign._id });
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_KEY_NOT_FOUND,
      errorCode: `Campaign created with id ${campaign._id}`,
    });
  }

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

  const emailsSentController = require("./emails-sent.controller");

  const emailsSentByCompany =
    await emailsSentController.readEmailsSentByCompanyId({
      companyId: campaign.company,
      startDate: activeBillingCycleDates.startDate,
      endDate: activeBillingCycleDates.endDate,
      project: {
        size: 1,
      },
    });

  let bandwidthSentByCompany = emailsSentByCompany
    .map((item) => item.size)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  let [companyBalance, planIds] = await Promise.all([
    stripeController.readCustomerBalance({
      companyId: campaign.company,
      stripeCustomerId: company.stripeCustomerId
    }),
    stripeController.readPlanIds({
      stripeCustomerId: company.stripeCustomerId,
    }),
  ]);

  companyBalance = companyBalance * 100; //converting into cents

  const plan = await Plan.findById(planIds[0].planId);

  let emailOverageCharge = 0,
    bandwidthOverageCharge = 0;

  if (plan.quota.email < campaignRecipientsCount + emailsSentByCompany.length) {
    emailOverageCharge = calculateEmailOverageCharge({
      unpaidEmailsCount: campaignRecipientsCount,
      plan,
      currency: company.region === REGIONS.CANADA ? "CAD" : "USD",
    });

    if (companyBalance < emailOverageCharge) {
      await draftCampaign({ campaignId: campaign._id });

      await sesUtil.sendEmail({
        fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
        toEmailAddress: primaryUser.emailAddress,
        subject: RESPONSE_MESSAGES.EMAIL_LIMIT_REACHED,
        content: `Dear ${primaryUser.firstName},
        We have restricted your campaign from running because you don't have enough credits to pay for
        the new campaign. As your quota for ${plan.name} is fully consumed. So we recommend you to top-up
        into your account by visiting the link below and try again.

        ${PUBLIC_CIRCLES_WEB_URL}/dashboard/subscription
        `,
        contentType: TEMPLATE_CONTENT_TYPE.TEXT,
      });

      throw createHttpError(400, {
        errorMessage: `${RESPONSE_MESSAGES.EMAIL_LIMIT_REACHED} Minimum ${
          company?.region === REGIONS.CANADA ? "CAD" : "USD"
        } ${
          parseInt(emailOverageCharge - companyBalance) / 100
        } credits required.`,
        errorKind: "EMAIL_LIMIT_REACHED",
        errorCode: `Campaign created with id ${campaign._id}`,
      });
    }
  }

  if (
    plan.quota.bandwidth <
    bandwidthSentByCompany +
      campaign.emailTemplate.size * campaignRecipientsCount
  ) {
    bandwidthOverageCharge = calculateBandwidthOverageCharge({
      unpaidBandwidth: campaign.emailTemplate.size * campaignRecipientsCount,
      plan,
      currency: company.region === REGIONS.CANADA ? "CAD" : "USD",
    });

    if (companyBalance < (bandwidthOverageCharge + emailOverageCharge)) {
      await draftCampaign({ campaignId: campaign._id });

      await sesUtil.sendEmail({
        fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
        toEmailAddress: primaryUser.emailAddress,
        subject: RESPONSE_MESSAGES.BANDWIDTH_LIMIT_REACHED,
        content: `Dear ${primaryUser.firstName},
        We have restricted your campaign from running because you don't have enough credits to pay for
        the new campaign. As your quota for ${plan.name} is fully consumed. So we recommend you to top-up
        into your account by visiting the link below and try again.

        ${PUBLIC_CIRCLES_WEB_URL}/dashboard/subscription
        `,
        contentType: TEMPLATE_CONTENT_TYPE.TEXT,
      });

      throw createHttpError(400, {
        errorMessage: `${RESPONSE_MESSAGES.BANDWIDTH_LIMIT_REACHED} Minimum ${
          company?.region === REGIONS.CANADA ? "CAD" : "USD"
        } ${
          parseInt((bandwidthOverageCharge + emailOverageCharge) - companyBalance) / 100
        } credits required.`,
        errorKind: "BANDWIDTH_LIMIT_REACHED",
        errorCode: `Campaign created with id ${campaign._id}`,
      });
    }
  }
};

const getCampaignBandwidthUsage = ({ emailSentDocsArray }) =>
  emailSentDocsArray
    .map((item) => item.size)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

const readCampaignUsageDetails = async ({ companyId, stripeCustomerId }) => {
  const stripeController = require("./stripe.controller");

  const [campaignIds, planIds] = await Promise.all([
    Campaign.distinct("_id", { company: companyId }),
    stripeController.readPlanIds({
      stripeCustomerId,
    }),
  ]);
  const activeBillingDates = await stripeController.readActiveBillingCycleDates({
    stripeCustomerId,
  });

  const company = await Company.findById(companyId);
  const currency = company.region === REGIONS.CANADA ? "CAD" : "USD";

  const plan = await Plan.findById(planIds[0].planId);

  const promises = [];
  const emailSentPromises = [];

  const emailSentController = require("./emails-sent.controller");

  campaignIds.forEach((campaignId) => {
    promises.push(
      Campaign.findById(campaignId).select("emailSubject lastProcessed")
    );
    emailSentPromises.push(
      emailSentController.readEmailsSentByCampaignId({
        campaignId,
        startDate: activeBillingDates.startDate,
      endDate: activeBillingDates.endDate,
      })
    );
  });

  let promisesResult = await Promise.all(promises);

  promisesResult = promisesResult
    .map((item) => ({
      emailSubject: item.emailSubject,
      lastProcessed: item.lastProcessed,
    }))
    .filter((item) => item);

  const emailsSentByCompany = await Promise.all(emailSentPromises);

  let emailUsageIterated = 0,
    bandwidthUsageIterated = 0,
    isEmailOverage = false,
    isBandwidthOverage = false,
    emailOverageIterator = 0,
    bandwidthOverageIterator = 0,
    emailRemainder = 0,
    bandwidthRemainder = 0,
    emailSubject = "";

  let emailUsage = campaignIds.map((campaignId, index) => {
    const emailUsage = emailsSentByCompany[index].length;

    emailSubject = promisesResult[index].emailSubject;

    campaignLastProcessed = promisesResult[index].lastProcessed;

    emailUsageIterated = emailUsageIterated + emailUsage;

    const bandwidthUsage = parseFloat(
      basicUtil
        .calculateByteUnit({
          bytes: getCampaignBandwidthUsage({
            emailSentDocsArray: emailsSentByCompany[index],
          }),
        })
        .split(" ")[0]
    );

    bandwidthUsageIterated =
      bandwidthUsageIterated +
      getCampaignBandwidthUsage({
        emailSentDocsArray: emailsSentByCompany[index],
      });

    const bandwidthUsageUnit = basicUtil
      .calculateByteUnit({
        bytes: getCampaignBandwidthUsage({
          emailSentDocsArray: emailsSentByCompany[index],
        }),
      })
      .split(" ")[1];

    if (emailUsageIterated - plan.quota.email > 0) {
      isEmailOverage = true;
      emailOverageIterator++;
    } else {
      emailRemainder = emailRemainder + emailUsage;
    }

    if (bandwidthUsageIterated - plan.quota.bandwidth > 0) {
      isBandwidthOverage = true;
      bandwidthOverageIterator++;
    } else {
      bandwidthRemainder =
        bandwidthRemainder +
        getCampaignBandwidthUsage({
          emailSentDocsArray: emailsSentByCompany[index],
        });
    }

    const emailOverage =
      isEmailOverage && emailOverageIterator === 1
        ? emailUsage + emailRemainder - plan.quota.email
        : isEmailOverage
        ? emailUsage
        : 0;

    const bandwidthOverage =
      isBandwidthOverage && bandwidthOverageIterator === 1
        ? basicUtil.calculateByteUnit({
            bytes:
              getCampaignBandwidthUsage({
                emailSentDocsArray: emailsSentByCompany[index],
              }) +
              bandwidthRemainder -
              plan.quota.bandwidth,
          })
        : isBandwidthOverage
        ? basicUtil.calculateByteUnit({
            bytes: getCampaignBandwidthUsage({
              emailSentDocsArray: emailsSentByCompany[index],
            }),
          })
        : 0;

    const pricePerEmail = parseFloat(
      currency === "USD"
        ? plan.bundles.email.priceInSmallestUnitUSD
        : plan.bundles.email.priceInSmallestUnitCAD
    );

    const pricePerBandwidth = parseFloat(
      currency === "USD"
        ? plan.bundles.bandwidth.priceInSmallestUnitUSD
        : plan.bundles.bandwidth.priceInSmallestUnitCAD
    );

    const emailUsageValue =
      isEmailOverage && emailOverageIterator === 1
        ? emailUsage + emailRemainder - plan.quota.email
        : isEmailOverage
        ? emailUsage
        : 0;

    const bandwidthUsageValue =
      isBandwidthOverage && bandwidthOverageIterator === 1
        ? getCampaignBandwidthUsage({
            emailSentDocsArray: emailsSentByCompany[index],
          }) +
          bandwidthRemainder -
          plan.quota.bandwidth
        : isBandwidthOverage
        ? getCampaignBandwidthUsage({
            emailSentDocsArray: emailsSentByCompany[index],
          })
        : 0;
    const bandwidthUsageValueKB = Number((bandwidthUsageValue / 1000).toFixed(2));
    const overagePrice = {
      email: emailUsageValue * pricePerEmail,
      bandwidth: bandwidthUsageValueKB * pricePerBandwidth,
      currency: company.region === REGIONS.CANADA ? "CAD" : "USD",
    };

    return {
      campaignId,
      emailSubject,
      campaignLastProcessed,
      emailUsage,
      emailOverage,
      bandwidthUsage,
      bandwidthOverage,
      bandwidthUsageUnit,
      overagePrice,
    };
  });

  emailUsage = emailUsage
    .filter((item) => {
      if (item.emailUsage && item.bandwidthUsage) {
        return item;
      }
    })
    .sort((a, b) => b.campaignLastProcessed - a.campaignLastProcessed);

  return emailUsage;
};

const getQueueUrl = () => {
  const env = process.env.ENVIRONMENT;

  const queueUrls = {
    LOCAL: process.env.AWS_QUEUE_URL_LOCAL,
    STAGING: process.env.AWS_QUEUE_URL_STAGING,
    PRODUCTION: process.env.AWS_QUEUE_URL_PRODUCTION,
  };

  return queueUrls[env];
};

const validateCampaignCompanyId = async ({
  campaignCompanyId,
  companyId,
  isUpdate = false,
}) => {
  if (campaignCompanyId) {
    const campaignExists = await Campaign.find({
      campaignCompanyId: campaignCompanyId,
      company: companyId,
      status: { $ne: CAMPAIGN_STATUS.DELETED },
    });

    if (isUpdate) {
      if (campaignExists.length > 1) {
        throw createHttpError(400, {
          errorMessage: RESPONSE_MESSAGES.CAMPAIGN_COMPANY_ID_EXISTS,
        });
      }
    } else {
      if (campaignExists.length > 0) {
        throw createHttpError(400, {
          errorMessage: RESPONSE_MESSAGES.CAMPAIGN_COMPANY_ID_EXISTS,
        });
      }
    }
  }
};

const getCompanyCampaignId = async ({ companyId, companyName }) => {
  const totalCampaigns = await Campaign.countDocuments({ company: companyId });
  let index = totalCampaigns + 1 || 1;
  let campaignCompanyId;
  let exists;

  do {
    campaignCompanyId = `${companyName}-${index}`;
    exists = await Campaign.findOne({
      campaignCompanyId,
      company: companyId,
      status: { $ne: CAMPAIGN_STATUS.DELETED },
    });
    index++;
  } while (exists);

  return campaignCompanyId;
};


module.exports = {
  createCampaign,
  readCampaign,
  readPaginatedCampaigns,
  readAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendTestEmail,
  sendSstEmail,
  runCampaign,
  readPaginatedCampaignLogs,
  readAllCampaignLogs,
  readCampaignRecipientsCount,
  validateCampaign,
  readCampaignUsageDetails,
  readCampaign,
  readSegmentPopulatedCampaign,
  buildCombinedQueryFromSegments,
  getCompanyCampaignId,
};
