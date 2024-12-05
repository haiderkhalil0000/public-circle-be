const { CampaignRun, EmailSent, Segment } = require("../models");
const {
  basicUtil,
  constants: {
    MODELS: { CAMPAIGN },
  },
} = require("../utils");

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
      .populate(CAMPAIGN)
      .lean(),
  ]);

  // const promises = [];

  const promises = campaignRuns.map(async (item) => {
    // Replace segmentIds with the corresponding segment objects
    const segments = await Promise.all(
      item.campaign.segments.map((segmentId) =>
        Segment.findById(segmentId).select("filters")
      )
    );

    // Update the segments in place
    item.campaign.segments = segments;
    return item; // Optionally return the updated item
  });

  await Promise.all(promises);

  const companyUsersController = require("./company-users.controller");
  await Promise.all(
    campaignRuns.map(async (campaignRun) => {
      let totalUsersCount = 0;

      await Promise.all(
        campaignRun.campaign.segments.map(async (segment) => {
          const result = await companyUsersController.getFiltersCount({
            companyId: campaignRun.company,
            filters: segment.filters,
          });

          if (Array.isArray(result)) {
            totalUsersCount += result.reduce(
              (sum, item) => sum + item.filterCount,
              0
            );
          }
        })
      );

      campaignRun.usersCount = totalUsersCount;
    })
  );

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
