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
        buffer: profilePicture.buffer,
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
      user: currentUserId,
    });

    if (companyDoc) {
      companyDoc.name = companyName;

      promises.push(companyDoc.save());
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
    const startOfYear = now
      .clone()
      .subtract(9, "years")
      .startOf("year")
      .toDate();
    const endOfYear = now.endOf("year").toDate();
    matchStage.createdAt = { $gte: startOfYear, $lte: endOfYear };
    groupStage = { _id: { $year: "$createdAt" } };

    const currentYear = now.year();
    const last10Years = Array.from(
      { length: 10 },
      (_, i) => currentYear - 9 + i
    );

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    return formatAndFillResults(
      result,
      last10Years,
      last10Years.reduce((map, year) => {
        map[year] = year.toString();
        return map;
      }, {})
    );
  }

  if (graphScope === GRAPH_SCOPES.MONTH) {
    const startOfLast12Months = now
      .clone()
      .subtract(11, "months")
      .startOf("month")
      .toDate();
    const endOfCurrentMonth = now.endOf("month").toDate();
    matchStage.createdAt = {
      $gte: startOfLast12Months,
      $lte: endOfCurrentMonth,
    };
    groupStage = {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
    };

    const last12Months = Array.from({ length: 12 }, (_, i) =>
      now
        .clone()
        .subtract(11 - i, "months")
        .format("YYYY-MM")
    );

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    return formatAndFillResults(
      result,
      last12Months,
      last12Months.reduce((map, month) => {
        map[month] = month;
        return map;
      }, {})
    );
  }

  if (graphScope === GRAPH_SCOPES.DAY) {
    const startOfLast30Days = now
      .clone()
      .subtract(29, "days")
      .startOf("day")
      .toDate();
    const endOfToday = now.endOf("day").toDate();
    matchStage.createdAt = { $gte: startOfLast30Days, $lte: endOfToday };
    groupStage = {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    };

    const last30Days = Array.from({ length: 30 }, (_, i) =>
      now
        .clone()
        .subtract(29 - i, "days")
        .format("YYYY-MM-DD")
    );

    const result = await EmailSent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupStage._id,
          count: { $sum: 1 },
        },
      },
    ]);

    return formatAndFillResults(
      result,
      last30Days,
      last30Days.reduce((map, day) => {
        map[day] = day;
        return map;
      }, {})
    );
  }

  throw new Error("Invalid graphScope");
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
    User.countDocuments({
      company: companyId,
      isEmailVerified: true,
      status: USER_STATUS.ACTIVE,
    }),
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
