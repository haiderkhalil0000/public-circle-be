const moment = require("moment");
const CronJob = require("cron").CronJob;

const { Cron, Campaign } = require("../models");
const {
  constants: { CRON_RECORD_LIMIT, CRON_STATUS, CRON_JOBS },
} = require("../utils");
const {
  CRON_INTERVALS,
  RUN_MODE,
  DOCUMENT_STATUS,
} = require("../utils/constants.util");
const { campaignsController } = require("../controllers");
// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

new CronJob(
  "*/5 * * * *",
  async function () {
    console.log(`called run-campaign.cron at ${moment().format("LLL")}`);

    const duration = {};
    let recordsUpdated = 0;

    duration.startTime = moment().format("LLL");

    try {
      const pendingCampaigns = await Campaign.find({
        $or: [
          {
            runMode: { $in: [RUN_MODE.INSTANT, RUN_MODE.SCHEDULE] },
            cronStatus: CRON_STATUS.PENDING,
            status: DOCUMENT_STATUS.ACTIVE,
          },
          { isRecurring: true, status: DOCUMENT_STATUS.ACTIVE },
        ],
      });

      for (const campaign of pendingCampaigns) {
        if (
          campaign.runMode === RUN_MODE.INSTANT ||
          (campaign.runMode === RUN_MODE.SCHEDULE &&
            moment().isAfter(moment(campaign.runSchedule)))
        ) {
          recordsUpdated++;

          campaignsController.runCampaign({ campaign });
        } else if (campaign.isRecurring) {
          recordsUpdated++;

          const recurringPeriod = moment.duration(campaign.recurringPeriod);
          const lastProcessedTime = campaign.lastProcessed
            ? moment(campaign.lastProcessed)
            : moment(campaign.createdAt);

          if (moment().isAfter(lastProcessedTime.add(recurringPeriod))) {
            campaignsController.runCampaign({ campaign });
          }
        }
      }

      await Cron.create({
        cronName: CRON_JOBS.RUN_CAMPAIGN,
        interval: CRON_INTERVALS["5M"],
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
