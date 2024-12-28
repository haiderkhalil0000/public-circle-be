const createHttpError = require("http-errors");
const randomString = require("randomstring");

const {
  User,
  Company,
  CompanyUser,
  Campaign,
  EmailSent,
  ReferralCode,
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
  signUpStepsCompleted,
  watchTutorialStepsCompleted,
  currentUser,
}) => {
  let companyDoc;
  const promises = [];

  const userUpdates = {
    emailAddress,
    password,
    profilePicture:
      profilePicture &&
      (await s3Util.uploadImageToS3({
        s3Path: `user-profile-pictures/${currentUser._id}/${profilePicture.fieldname}.png`,
        buffer: profilePicture.buffer,
      })),
    firstName,
    lastName,
    phoneNumber,
    secondaryEmail,
    role,
    signUpStepsCompleted,
    watchTutorialStepsCompleted,
  };

  if (firstName && !currentUser.referralCode) {
    const referralCodeDoc = await ReferralCode.create({
      code: `urc_${firstName.replace(/ /g, "")}_${randomString.generate({
        length: 4,
        charset: "numeric",
      })}`,
      user: currentUser._id,
    });

    userUpdates.referralCode = referralCodeDoc._id;
  }

  if (role) {
    basicUtil.validateObjectId({ inputString: role });
  }

  if (companyName) {
    companyDoc = await Company.findOne({
      _id: currentUser.company,
    });

    if (companyDoc) {
      companyDoc.name = companyName;

      promises.push(companyDoc.save());
    } else {
      const stripeController = require("./stripe.controller");

      companyDoc = await Company.create({
        name: companyName,
      });

      companyDoc.stripe = await stripeController.createStripeCustomer({
        companyId: companyDoc._id.toString(),
        companyName: companyDoc.name,
        emailAddress: currentUser.emailAddress,
      });

      await companyDoc.save();

      userUpdates.company = companyDoc._id;
    }
  }

  if (companySize || address || postalCode || city || province || country) {
    promises.push(
      Company.updateOne(
        { _id: userUpdates.company || currentUser.company._id },
        { companySize, address, postalCode, city, province, country }
      )
    );
  }

  promises.push(User.updateOne({ _id: currentUser._id }, userUpdates));

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

  const [totalRecords, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
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

const readDashboardData = async ({ currentUserId, companyId, graphScope }) => {
  const emailsSentController = require("./emails-sent-controller");
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
      _id: { $ne: currentUserId },
    }),
    CompanyUser.countDocuments({ company: companyId }),
    Campaign.countDocuments({
      company: companyId,
      status: CAMPAIGN_STATUS.ACTIVE,
    }),
    EmailSent.countDocuments({ company: companyId }),
    emailsSentController.readEmailSentGraphData({ graphScope, companyId }),
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
  const [referralCodeDoc, currentUserDoc, genericReward] = await Promise.all([
    ReferralCode.findOne({
      code: referralCode,
    }).populate("reward"),
    User.findById(currentUserId),
    Reward.findOne({ isGeneric: true }),
  ]);

  if (currentUserDoc.invalidReferralCodeAttempts >= 8) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.REFERRAL_CODE_INPUT_LOCKED,
    });
  }

  if (!referralCodeDoc) {
    currentUserDoc.invalidReferralCodeAttempts =
      currentUserDoc.invalidReferralCodeAttempts + 1;

    currentUserDoc.save();

    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_REFERRAL_CODE,
    });
  }

  currentUserDoc.referralCodeConsumed = referralCodeDoc._id;
  currentUserDoc.invalidReferralCodeAttempts = 0;

  await currentUserDoc.save();

  if (referralCodeDoc.reward) {
    return referralCodeDoc.reward;
  }

  return genericReward;
};

const readCurrentUser = ({ currentUserId }) =>
  User.findById(currentUserId)
    .populate("company")
    .populate("role")
    .populate("referralCode", "code");

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
  readCurrentUser,
};
