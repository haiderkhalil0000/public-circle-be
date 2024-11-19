const moment = require("moment");
const CronJob = require("cron").CronJob;

const { Cron, Campaign } = require("../models");
const { campaignsController } = require("../controllers");
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

// Buffer for 5-minute window
const TIME_BUFFER = moment.duration(5, "minutes");

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
      });

      for (const campaign of pendingCampaigns) {
        const currentTime = moment();

        if (campaign.runMode === RUN_MODE.SCHEDULE) {
          const scheduledTime = moment(campaign.runSchedule);

          // Check if the current time is after the scheduled time and within the buffer
          if (
            scheduledTime.isSameOrBefore(currentTime) &&
            currentTime.diff(scheduledTime) <= TIME_BUFFER.asMilliseconds()
          ) {
            recordsUpdated++;
            campaignsController.runCampaign({ campaign });
          }
        } else if (campaign.isRecurring) {
          const recurringPeriod = moment.duration(campaign.recurringPeriod);
          const lastProcessedTime = campaign.lastProcessed
            ? moment(campaign.lastProcessed)
            : moment(campaign.createdAt);

          // Check if current time is after the last processed time + recurring period, within the buffer
          if (
            currentTime.isAfter(lastProcessedTime.add(recurringPeriod)) &&
            currentTime.diff(lastProcessedTime.add(recurringPeriod)) <=
              TIME_BUFFER.asMilliseconds()
          ) {
            recordsUpdated++;
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
