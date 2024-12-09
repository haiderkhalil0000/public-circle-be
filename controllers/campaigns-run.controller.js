const { CampaignRun, EmailSent } = require("../models");
const { basicUtil } = require("../utils");

const readCampaignRunsStats = async ({ campaignId, graphScope }) => {
  basicUtil.validateObjectId({ inputString: campaignId });

  let campaignRunIds = await CampaignRun.distinct("_id", {
    campaign: campaignId,
  });

  const query = { campaignRun: { $in: campaignRunIds } };

  const emailsSentController = require("./emails-sent-controller");

  const [
    totalEmailsSent,
    totalEmailsDelayed,
    totalEmailsDelivered,
    totalEmailsFailed,
    totalEmailsOpened,
    graphData,
  ] = await Promise.all([
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Send": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.DeliveryDelay": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Delivery": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Bounce": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Open": { $exists: true },
    }),
    emailsSentController.readEmailSentGraphData({ graphScope, campaignId }),
  ]);

  return {
    totalCampaignRuns: campaignRunIds.length,
    totalEmailsSent,
    totalEmailsDelayed,
    totalEmailsDelivered,
    totalEmailsFailed,
    totalEmailsOpened,
    graphData,
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

const readCampaignRunEmailsSentStats = async ({
  campaignRunId,
  graphScope,
}) => {
  const query = { campaignRun: campaignRunId };

  const emailsSentController = require("./emails-sent-controller");

  const [
    totalEmailsSent,
    totalEmailsDelayed,
    totalEmailsDelivered,
    totalEmailsFailed,
    totalEmailsOpened,
    graphData,
  ] = await Promise.all([
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Send": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.DeliveryDelay": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Delivery": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Bounce": { $exists: true },
    }),
    EmailSent.countDocuments({
      ...query,
      "emailEvents.Open": { $exists: true },
    }),
    emailsSentController.readEmailSentGraphData({ graphScope, campaignRunId }),
  ]);

  return {
    totalEmailsSent,
    totalEmailsDelayed,
    totalEmailsDelivered,
    totalEmailsFailed,
    totalEmailsOpened,
    graphData,
  };
};

const readCampaignRunEmailsSent = ({ campaignRunId, pageNumber, pageSize }) =>
  EmailSent.find({ campaignRun: campaignRunId })
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(pageSize);

module.exports = {
  readPaginatedCampaignsRun,
  readCampaignRunsStats,
  readCampaignRunEmailsSentStats,
  readCampaignRunEmailsSent,
};
