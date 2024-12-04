const { CampaignRun, EmailSent } = require("../models");
const { basicUtil } = require("../utils");

const readCampaignRunsStats = async ({ campaignId }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  let campaignRunIds = await CampaignRun.distinct("_id", {
    campaign: campaignId,
  });

  const query = { campaignRun: { $in: campaignRunIds } };

  const [totalEmailsSent, totalEmailsOpened] = await Promise.all([
    EmailSent.countDocuments(query),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Open": { $exists: true },
    }),
  ]);

  return {
    totalCampaignRuns: campaignRunIds.length,
    totalEmailsSent,
    totalEmailsOpened,
  };
};

const readPaginatedCampaignsRun = async ({
  campaignId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  const query = { campaign: campaignId };

  const [totalRecords, campaignRuns] = await Promise.all([
    CampaignRun.countDocuments(query),
    CampaignRun.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const promises = [];

  campaignRuns.forEach((item) => {
    promises.push(EmailSent.countDocuments({ campaignRun: item._id }));
  });

  const emailCountsInCampaignRun = await Promise.all(promises);

  campaignRuns.forEach((item, index) => {
    item.emailsSentCount = emailCountsInCampaignRun[index];
  });

  return {
    totalRecords,
    campaignRuns,
  };
};

const readCampaignRunEmailsSent = ({ campaignRunId, pageNumber, pageSize }) =>
  EmailSent.find({ campaignRun: campaignRunId })
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(pageSize);

const readCampaignRunEmailsSentStats = async ({ campaignRunId }) => {
  const [
    totalEmailsSent,
    totalEmailsDelivered,
    totalEmailsOpened,
    totalEmailsSpammed,
  ] = await Promise.all([
    EmailSent.countDocuments({
      campaignRun: campaignRunId,
      "emailEvents.Send": { $exists: true },
    }),

    EmailSent.countDocuments({
      campaignRun: campaignRunId,
      "emailEvents.Delivery": { $exists: true },
    }),

    EmailSent.countDocuments({
      campaignRun: campaignRunId,
      "emailEvents.Open": { $exists: true },
    }),

    EmailSent.countDocuments({
      campaignRun: campaignRunId,
      "emailEvents.Complaint": { $exists: true },
    }),
  ]);

  return {
    totalEmailsSent,
    totalEmailsDelivered,
    totalEmailsOpened,
    totalEmailsSpammed,
  };
};

module.exports = {
  readPaginatedCampaignsRun,
  readCampaignRunsStats,
  readCampaignRunEmailsSentStats,
  readCampaignRunEmailsSent,
};
