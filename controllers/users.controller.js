const moment = require("moment");
const createHttpError = require("http-errors");

const {
  User,
  Company,
  CompanyUser,
  Campaign,
  EmailSent,
} = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, USER_STATUS, CAMPAIGN_STATUS },
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
    profilePicture: await s3Util.uploadImageToS3({
      s3Path: `user-profile-pictures/${currentUserId}/${profilePicture.fieldname}.png`,
    }),
    firstName,
    lastName,
    phoneNumber,
    secondaryEmail,
    role,
    signUpStepsCompleted,
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

const readDashboardData = async ({
  companyId,
  fromDate = "1 january 1970",
  toDate = "1 january 2099",
}) => {
  const [
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
    emailsSentCountInRange,
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
  ]);

  return {
    companyUsersCount,
    companyContactsCount,
    runningCampaignsCount,
    emailsSentCount,
    emailsSentCountInRange,
  };
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
};
