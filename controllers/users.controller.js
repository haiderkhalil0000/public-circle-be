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
  constants: { RESPONSE_MESSAGES, USER_STATUS, CAMPAIGN_STATUS, USER_KIND },
  s3Util,
} = require("../utils");

const { ADMIN_ROLE_ID } = process.env;

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
  roleId,
  companyId,
  currentUserId,
}) => {
  basicUtil.validateObjectId({ inputString: roleId });

  if (roleId.toString() === ADMIN_ROLE_ID) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ADMIN_ROLE_NOT_ALLOWED,
    });
  }

  const existingUserDoc = await User.findOne({
    emailAddress,
    isEmailVerified: true,
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
      role: roleId,
      company: companyId,
      kind: USER_KIND.SECONDARY,
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

const MONTH_NAMES = moment.months().map((month) => month.substring(0, 3)); // ['Jan', 'Feb', ... 'Dec']

const getGraphData = async ({ graphScope, companyId }) => {
  const matchStage = { company: companyId };

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

const readDashboardData = async ({ companyId, graphScope }) => {
  const [
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
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
    getGraphData({ graphScope, companyId }),
  ]);

  return {
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
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

  if (!userDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_REFERRAL_CODE,
    });
  }

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
