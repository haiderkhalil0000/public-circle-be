const moment = require("moment");
const createHttpError = require("http-errors");
const randomString = require("randomstring");

const {
  User,
  Company,
  CompanyUser,
  Campaign,
  EmailSent,
} = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, USER_STATUS, CAMPAIGN_STATUS, GRAPH_SCOPES },
  s3Util,
} = require("../utils");

const updateUser = async ({
  emailAddress,
  password,
  profilePicture,
  firstName,
  lastName,
  companyName,
  phoneNumber,
  secondaryEmail,
  companySize,
  address,
  postalCode,
  city,
  province,
  country,
  role,
  currentUserId,
  signUpStepsCompleted,
}) => {
  let companyDoc;
  const promises = [];

  const userUpdates = {
    emailAddress,
    password,
    profilePicture:
      profilePicture &&
      (await s3Util.uploadImageToS3({
        s3Path: `user-profile-pictures/${currentUserId}/${profilePicture.fieldname}.png`,
      })),
    firstName,
    lastName,
    phoneNumber,
    secondaryEmail,
    role,
    signUpStepsCompleted,
    referralCode: firstName
      ? `urc_${firstName.replace(/ /g, "")}_${randomString.generate({
          length: 4,
          charset: "numeric",
        })}`
      : undefined,
  };

  if (role) {
    basicUtil.validateObjectId({ inputString: role });
  }

  if (companyName) {
    companyDoc = await Company.findOne({
      name: companyName,
      user: currentUserId,
    });

    if (companyDoc) {
      promises.push((companyDoc.name = companyName));
    } else {
      const stripeController = require("./stripe.controller");

      companyDoc = await Company.create({
        name: companyName,
        user: currentUserId,
      });

      companyDoc.stripe = await stripeController.createStripeCustomer({
        companyName: companyDoc.name,
        companyId: companyDoc._id.toString(),
      });

      await companyDoc.save();

      userUpdates.company = companyDoc._id;
    }
  }

  if (companySize || address || postalCode || city || province || country) {
    promises.push(
      Company.updateOne(
        { user: currentUserId },
        { companySize, address, postalCode, city, province, country }
      )
    );
  }

  promises.push(User.updateOne({ _id: currentUserId }, userUpdates));

  await Promise.all(promises);
};

const createUserUnderACompany = async ({
  emailAddress,
  name,
  role,
  companyId,
  currentUserId,
}) => {
  basicUtil.validateObjectId({ inputString: role });

  const existingUserDoc = await User.findOne({
    emailAddress,
    company: companyId,
    status: USER_STATUS.ACTIVE,
  });

  if (existingUserDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.USER_EXISTS_ALREADY,
    });
  }

  const authController = require("./auth.controller");

  return Promise.all([
    User.create({
      emailAddress,
      firstName: name,
      role,
      company: companyId,
    }),
    authController.sendInvitationEmail({ emailAddress, currentUserId }),
  ]);
};

const readPaginatedUsersUnderACompany = async ({
  companyId,
  pageNumber,
  pageSize,
}) => {
  const query = {
    company: companyId,
  };

  const [totalCount, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    users,
  };
};

const readAllUsersUnderACompany = async ({ companyId, currentUserId }) =>
  User.find({
    _id: { $ne: currentUserId },
    company: companyId,
    status: USER_STATUS.ACTIVE,
  }).populate("role", "name");

const readUserUnderACompany = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({ inputString: userId });

  const userDoc = await User.find({
    _id: userId,
    company: companyId,
  });

  if (!userDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.USER_NOT_FOUND,
    });
  }

  return userDoc;
};

const updateUserUnderACompany = async ({ companyId, userId, roleId }) => {
  basicUtil.validateObjectId({ inputString: userId });
  basicUtil.validateObjectId({ inputString: roleId });

  const result = await User.updateOne(
    {
      _id: userId,
      company: companyId,
    },
    { role: roleId }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.USER_NOT_FOUND,
    });
  }
};

const deleteUserUnderACompany = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({ inputString: userId });

  const result = await User.updateOne(
    {
      _id: userId,
      company: companyId,
    },
    { status: USER_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.USER_NOT_FOUND,
    });
  }
};

const getGraphData = async ({ graphScope, companyId }) => {
  const matchStage = { company: companyId };
  let groupStage = {};
  const now = moment();

  // Utility to format and fill results
  const formatAndFillResults = (result, allKeys, keyMap) => {
    const counts = result.reduce((acc, item) => {
      acc[keyMap[item._id]] = item.count;
      return acc;
    }, {});
    return allKeys.reduce((final, key) => {
      final[keyMap[key]] = counts[keyMap[key]] || 0;
      return final;
    }, {});
  };

  if (graphScope === GRAPH_SCOPES.YEAR) {
    const startOfYear = now.startOf("year").toDate();
    const endOfYear = now.endOf("year").toDate();
    matchStage.createdAt = { $gte: startOfYear, $lte: endOfYear };
    groupStage = { _id: { $month: "$createdAt" } };

    const monthsMap = {
      1: "jan",
      2: "feb",
      3: "mar",
      4: "apr",
      5: "may",
      6: "jun",
      7: "jul",
      8: "aug",
      9: "sep",
      10: "oct",
      11: "nov",
      12: "dec",
    };
    const allMonths = Object.keys(monthsMap).map(Number);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    return formatAndFillResults(result, allMonths, monthsMap);
  }

  if (graphScope === GRAPH_SCOPES.MONTH) {
    const startOfMonth = now.startOf("month").toDate();
    const endOfMonth = now.endOf("month").toDate();

    // Match documents for the current month
    matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

    // Group by custom week numbers based on the start date of each week
    groupStage = {
      $cond: [
        { $lte: [{ $dayOfMonth: "$createdAt" }, 7] },
        "week1",
        {
          $cond: [
            { $lte: [{ $dayOfMonth: "$createdAt" }, 14] },
            "week2",
            {
              $cond: [
                { $lte: [{ $dayOfMonth: "$createdAt" }, 21] },
                "week3",
                {
                  $cond: [
                    { $lte: [{ $dayOfMonth: "$createdAt" }, 28] },
                    "week4",
                    {
                      $cond: [
                        { $lte: [{ $dayOfMonth: "$createdAt" }, 35] },
                        "week5",
                        "week6",
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    // Define all possible weeks for the current month
    const weeksMap = {
      week1: "week1",
      week2: "week2",
      week3: "week3",
      week4: "week4",
      week5: "week5",
      week6: "week6",
    };

    const allWeeks = Object.keys(weeksMap);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage,
          count: { $sum: 1 },
        },
      },
    ]);

    // Format the results to include all weeks, even those with no data
    const formattedResults = formatAndFillResults(result, allWeeks, weeksMap);

    if (!formattedResults.week6) {
      delete formattedResults.week6;
      if (!formattedResults.week5) {
        delete formattedResults.week5;
      }
    }

    return formattedResults;
  }

  if (graphScope === GRAPH_SCOPES.WEEK) {
    const startOfWeek = now.startOf("week").toDate();
    const endOfWeek = now.endOf("week").toDate();
    matchStage.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
    groupStage = { _id: { $dayOfWeek: "$createdAt" } };

    const daysMap = {
      1: "sunday",
      2: "monday",
      3: "tuesday",
      4: "wednesday",
      5: "thursday",
      6: "friday",
      7: "saturday",
    };
    const allDays = Object.keys(daysMap).map(Number);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    return formatAndFillResults(result, allDays, daysMap);
  }

  if (graphScope === GRAPH_SCOPES.DAY) {
    const startOfDay = now.startOf("day").toDate();
    const endOfDay = now.endOf("day").toDate();
    matchStage.createdAt = { $gte: startOfDay, $lte: endOfDay };
    groupStage = { _id: { $hour: "$createdAt" } };

    const hoursMap = Array.from({ length: 24 }, (_, i) => i).reduce(
      (acc, hour) => {
        const start = moment({ hour }).format("h:00A");
        const end = moment({ hour }).add(1, "hour").format("h:00A");
        acc[hour] = `${start}-${end}`;
        return acc;
      },
      {}
    );
    const allHours = Object.keys(hoursMap).map(Number);

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedResults = formatAndFillResults(result, allHours, hoursMap);

    const gmtOffset = moment().utcOffset() / 60;

    const timeObject = {
      "12:00AM-1:00AM": 0,
      "1:00AM-2:00AM": 0,
      "2:00AM-3:00AM": 0,
      "3:00AM-4:00AM": 0,
      "4:00AM-5:00AM": 0,
      "5:00AM-6:00AM": 0,
      "6:00AM-7:00AM": 0,
      "7:00AM-8:00AM": 0,
      "8:00AM-9:00AM": 0,
      "9:00AM-10:00AM": 0,
      "10:00AM-11:00AM": 0,
      "11:00AM-12:00PM": 0,
      "12:00PM-1:00PM": 0,
      "1:00PM-2:00PM": 0,
      "2:00PM-3:00PM": 0,
      "3:00PM-4:00PM": 0,
      "4:00PM-5:00PM": 0,
      "5:00PM-6:00PM": 0,
      "6:00PM-7:00PM": 0,
      "7:00PM-8:00PM": 0,
      "8:00PM-9:00PM": 2,
      "9:00PM-10:00PM": 1,
      "10:00PM-11:00PM": 0,
      "11:00PM-12:00AM": 0,
    };

    // Helper function to format time string to moment object
    const adjustTime = (timeString, offset) => {
      const format = "h:mma"; // 12-hour format with AM/PM
      const [start, end] = timeString
        .split("-")
        .map((time) => moment(time, format));

      // Add the GMT offset to both start and end times
      start.add(offset, "hours");
      end.add(offset, "hours");

      // Format the new time back to the string
      return `${start.format(format)}-${end.format(format)}`;
    };

    // Adjust all time ranges in the object
    const adjustedObject = Object.keys(timeObject).reduce((acc, timeRange) => {
      const adjustedRange = adjustTime(timeRange, gmtOffset);
      acc[adjustedRange] = timeObject[timeRange]; // Copy the value associated with the time range
      return acc;
    }, {});

    return adjustedObject;
  }
};

const readDashboardData = async ({
  companyId,
  fromDate = "1 january 1970",
  toDate = "1 january 2099",
  graphScope,
}) => {
  const [
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
    emailsSentCountInRange,
    emailsSentGraphData,
  ] = await Promise.all([
    User.countDocuments({ company: companyId, status: USER_STATUS.ACTIVE }),
    CompanyUser.countDocuments({ company: companyId }),
    Campaign.countDocuments({
      company: companyId,
      status: CAMPAIGN_STATUS.ACTIVE,
    }),
    EmailSent.countDocuments({ company: companyId }),
    EmailSent.countDocuments({
      company: companyId,
      $and: [
        {
          createdAt: {
            $gte: moment(fromDate).startOf("day").format(),
          },
        },
        {
          createdAt: {
            $lte: moment(toDate).endOf("day").format(),
          },
        },
      ],
    }),
    getGraphData({ graphScope, companyId }),
  ]);

  return {
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
    emailsSentCountInRange,
    emailsSentGraphData,
  };
};

const verifyReferralCode = async ({ referralCode, currentUserId }) => {
  const [userDoc, currentUserDoc] = await Promise.all([
    User.findOne({
      referralCode,
    }),
    User.findById(currentUserId),
  ]);

  userDoc.referree = currentUserDoc._id;
  currentUserDoc.referrer = userDoc._id;

  await Promise.all([userDoc.save(), currentUserDoc.save()]);
};

module.exports = {
  updateUser,
  createUserUnderACompany,
  readPaginatedUsersUnderACompany,
  readAllUsersUnderACompany,
  readUserUnderACompany,
  updateUserUnderACompany,
  deleteUserUnderACompany,
  readDashboardData,
  verifyReferralCode,
};
