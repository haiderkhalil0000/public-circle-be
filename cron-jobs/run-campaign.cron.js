const moment = require("moment");
const CronJob = require("cron").CronJob;

const { Cron, Campaign } = require("../models");
const { campaignsController, usersController } = require("../controllers");
const {
  constants: {
    CRON_RECORD_LIMIT,
    CRON_STATUS,
    CRON_JOBS,
    CRON_INTERVALS,
    RUN_MODE,
    CAMPAIGN_STATUS,
  },
} = require("../utils");

// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

new CronJob(
  "*/1 * * * *",
  async function () {
    console.log(`called run-campaign.cron at ${moment().format("LLL")}`);

    const duration = {};
    let recordsUpdated = 0;

    duration.startTime = moment().format("LLL");

    try {
      const pendingCampaigns = await Campaign.find({
        $or: [
          {
            runMode: RUN_MODE.SCHEDULE,
            cronStatus: CRON_STATUS.PENDING,
            processedCount: { $lt: 1 },
            status: CAMPAIGN_STATUS.ACTIVE,
          },
          {
            isRecurring: true,
            processedCount: { $gte: 1 },
            status: CAMPAIGN_STATUS.ACTIVE,
          },
        ],
      })
        .populate("company")
        .populate("segments");

      let primaryUsers = [];

      pendingCampaigns.forEach((campaign) =>
        primaryUsers.push(
          usersController.readPrimaryUserByCompanyId({
            companyId: campaign.company,
          })
        )
      );

      primaryUsers = await Promise.all(primaryUsers);

      pendingCampaigns.forEach(async (campaign, index) => {
        if (
          campaign.runMode === RUN_MODE.SCHEDULE &&
          campaign.processedCount < 1 &&
          moment().isSameOrAfter(moment(campaign.runSchedule).startOf("minute"))
        ) {
          recordsUpdated++;

          await campaignsController.validateCampaign({
            campaign,
            company: campaign.company,
            primaryUser: primaryUsers[index],
          });

          campaignsController.runCampaign({ campaign });
        } else if (campaign.isRecurring) {
          const campaignRecurring = campaign.recurringPeriod.split(" ");

          const recurringPeriod = moment.duration(
            parseInt(campaignRecurring[0]),
            campaignRecurring[1]
          );

          const lastProcessedTime = moment(campaign.lastProcessed).startOf(
            "minute"
          );

          if (moment().isSameOrAfter(lastProcessedTime.add(recurringPeriod))) {
            recordsUpdated++;

            await campaignsController.validateCampaign({
              campaign,
              company: campaign.company,
              primaryUser: primaryUsers[index],
            });

            campaignsController.runCampaign({ campaign });
          }
        }
      });

      await Cron.create({
        cronName: CRON_JOBS.RUN_CAMPAIGN,
        interval: CRON_INTERVALS["1M"],
        lastRunAt: moment().format("LLL"),
        recordsUpdated,
      });

      const cronJobIds = await Cron.find({
        cronName: CRON_JOBS.RUN_CAMPAIGN,
      })
        .sort({ lastRunAt: -1 })
        .limit(CRON_RECORD_LIMIT)
        .select("_id");

      if (cronJobIds.length >= 30) {
        await Cron.deleteMany({
          cronName: CRON_JOBS.RUN_CAMPAIGN,
          _id: { $nin: cronJobIds },
        });
      }

      duration.endTime = moment().format("LLL");
    } catch (err) {
      // sendErrorReportToSentry(err);
      console.log(err);
    } finally {
      await Cron.findOneAndUpdate(
        { cronName: CRON_JOBS.RUN_CAMPAIGN },
        { duration }
      ).sort({
        createdAt: -1,
      });
    }
  },
  null,
  true,
  "Asia/Karachi"
);
