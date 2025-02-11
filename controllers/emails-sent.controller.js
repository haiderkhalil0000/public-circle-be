const moment = require("moment");
const mongoose = require("mongoose");

const { EmailSent } = require("../models");
const { EMAIL_KIND } = require("../utils/constants.util");

const MONTH_NAMES = moment.months().map((month) => month.substring(0, 3)); // ['Jan', 'Feb', ... 'Dec']

const readEmailSentGraphData = async ({
  graphScope,
  companyId,
  campaignId,
  campaignRunId,
}) => {
  const matchStage = {};

  // Include company filter if specified
  if (companyId) {
    matchStage.company = new mongoose.Types.ObjectId(companyId);
  }

  // Include campaign filter if specified
  if (campaignId) {
    matchStage.campaign = new mongoose.Types.ObjectId(campaignId);
  }

  // Include campaignRun filter if specified
  if (campaignRunId) {
    matchStage.campaignRun = new mongoose.Types.ObjectId(campaignRunId);
  }

  // Utility: Generate Key Maps
  const generateKeyMap = (keys, labels) =>
    keys.reduce((map, key, index) => {
      map[key] = labels[index] || key;
      return map;
    }, {});

  // Utility: Fill Missing Data
  const fillMissingData = (result, keys, keyMap) => {
    const counts = result.reduce((acc, item) => {
      acc[keyMap[item._id]] = item.count;
      return acc;
    }, {});
    return keys.reduce((final, key) => {
      final[keyMap[key]] = counts[keyMap[key]] || 0;
      return final;
    }, {});
  };

  const now = moment();

  // Handle Yearly Scope
  if (graphScope.yearly) {
    const yearsCount = graphScope.yearly;
    const startOfYear = now
      .clone()
      .subtract(yearsCount - 1, "years")
      .startOf("year")
      .toDate();
    const endOfYear = now.endOf("year").toDate();
    matchStage.createdAt = { $gte: startOfYear, $lte: endOfYear };

    const years = Array.from(
      { length: yearsCount },
      (_, i) => now.year() - (yearsCount - 1) + i
    );
    const keyMap = generateKeyMap(years, years.map(String));

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $year: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    return fillMissingData(result, years, keyMap);
  }

  // Handle Monthly Scope
  if (graphScope.monthly) {
    const year = graphScope.monthly.year;
    const startOfYear = moment().year(year).startOf("year").toDate();
    const endOfYear = moment().year(year).endOf("year").toDate();
    matchStage.createdAt = { $gte: startOfYear, $lte: endOfYear };

    const months = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
    const keyMap = generateKeyMap(months, MONTH_NAMES);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    return fillMissingData(result, months, keyMap);
  }

  // Handle Daily Scope
  if (graphScope.daily) {
    const { month, year } = graphScope.daily;
    const monthIndex = moment().month(month).month(); // Convert month name to 0-based index
    const startOfMonth = moment()
      .year(year)
      .month(monthIndex)
      .startOf("month")
      .toDate();
    const endOfMonth = moment()
      .year(year)
      .month(monthIndex)
      .endOf("month")
      .toDate();
    matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

    const daysInMonth = moment().year(year).month(monthIndex).daysInMonth();
    const days = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    const dateKeys = Array.from({ length: daysInMonth }, (_, i) =>
      moment()
        .year(year)
        .month(monthIndex)
        .date(i + 1)
        .format("YYYY-MM-DD")
    );
    const keyMap = generateKeyMap(dateKeys, days);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    return fillMissingData(result, dateKeys, keyMap);
  }

  throw createHttpError(
    400,
    `Invalid graph scope: ${JSON.stringify(graphScope)}`
  );
};

const readEmailSentCount = ({ companyId }) =>
  EmailSent.countDocuments({
    company: companyId,
    kind: {
      $in: [EMAIL_KIND.REGULAR, EMAIL_KIND.TEST],
    },
  });

const readEmailContentConsumed = async ({ companyId }) => {
  const emailContentSizeDocs = await EmailSent.find(
    {
      company: companyId,
      kind: {
        $in: [EMAIL_KIND.REGULAR, EMAIL_KIND.TEST],
      },
    },
    {
      size: 1,
    }
  );

  return emailContentSizeDocs
    .map((item) => item.size)
    .reduce((total, current) => total + current, 0);
};

const readEmailsSentByCompanyId = ({
  companyId,
  startDate,
  endDate,
  project,
}) => {
  let query = { company: companyId };

  if (startDate && endDate) {
    query.createdAt = {
      $gte: startDate,
      $lt: endDate,
    };
  }

  return EmailSent.find(query, project);
};

const readEmailsSentByCampaignId = ({ campaignId }) =>
  EmailSent.find({ campaign: campaignId });

const createEmailSentDoc = ({
  companyId,
  campaignId,
  campaignRunId,
  fromEmailAddress,
  toEmailAddress,
  emailSubject,
  emailContent,
}) => {
  EmailSent.create({
    company: companyId,
    campaign: campaignId,
    campaignRun: campaignRunId,
    fromEmailAddress,
    toEmailAddress,
    emailSubject,
    emailContent,
  });
};

module.exports = {
  readEmailSentGraphData,
  readEmailsSentByCompanyId,
  readEmailSentCount,
  readEmailContentConsumed,
  readEmailsSentByCampaignId,
  createEmailSentDoc,
};
