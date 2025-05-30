const createHttpError = require("http-errors");
const randomString = require("randomstring");
const _ = require("lodash");

const {
  User,
  Company,
  CompanyContact,
  Campaign,
  EmailSent,
  ReferralCode,
  Reward,
  CompanyGrouping
} = require("../models");
const {
  basicUtil,
  constants: {
    RESPONSE_MESSAGES,
    USER_STATUS,
    CAMPAIGN_STATUS,
    USER_KIND,
    COMPANY_CONTACT_STATUS,
    COMPANY_GROUPING_TYPES,
  },
  s3Util,
} = require("../utils");

const { ADMIN_ROLE_ID } = process.env;

const updateUser = async ({
  emailAddress,
  password,
  profilePicture,
  companyLogo,
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
  contactsDisplayOrder,
  contactSelectionCriteria,
  emailKey,
  region
}) => {
  let companyDoc;
  const promises = [];
  const companyContactsController = require("./company-contacts.controller");

  if(currentUser?.company?._id){
    const company = await Company.findOne({
      _id: currentUser.company._id,
    });
  
    if (contactSelectionCriteria) {
      if (
        !_.isEqual(contactSelectionCriteria, company.contactSelectionCriteria)
      ) {
        await companyContactsController.revertFilterContactsBySelectionCriteria({
          companyId: currentUser.company._id,
          contactSelectionCriteria: company.contactSelectionCriteria,
        });
      }
    }
  }

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

      // await CompanyGrouping.create([
      //   {
      //     companyId: companyDoc._id,
      //     type: COMPANY_GROUPING_TYPES.TEMPLATE,
      //     groupName: "Welcome",
      //   },
      //   {
      //     companyId: companyDoc._id,
      //     type: COMPANY_GROUPING_TYPES.CAMPAIGN,
      //     groupName: "Welcome",
      //   },
      // ]);

      const stripeCustomer = await stripeController.createStripeCustomer({
        companyId: companyDoc._id.toString(),
        companyName: companyDoc.name,
        emailAddress: currentUser.emailAddress,
      });

      companyDoc.stripeCustomerId = stripeCustomer.id;

      await companyDoc.save();

      userUpdates.company = companyDoc._id;
    }
  }
  if (companyLogo) {
    userUpdates.companyLogo =
      companyLogo &&
      (await s3Util.uploadImageToS3({
        s3Path: `company-logo/${userUpdates.company}/logo.png`,
        buffer: companyLogo.buffer,
      }));
  }
  const companyExistingRecord = await Company.findOne({
      _id: currentUser.company,
    });
  let currency = "USD";
  if(companyExistingRecord && companyExistingRecord.region) {
    currency = companyExistingRecord.region === "CA" ? "CAD" : "USD";
  }
  if (
    companySize ||
    address ||
    postalCode ||
    city ||
    province ||
    country ||
    contactsDisplayOrder ||
    contactSelectionCriteria ||
    emailKey ||
    region
  ) {
    promises.push(
      Company.updateOne(
        { _id: userUpdates.company || currentUser.company._id },
        {
          companySize,
          address,
          postalCode,
          city,
          province,
          country,
          contactsDisplayOrder,
          contactSelectionCriteria,
          emailKey,
          region,
          currency,
        }
      )
    );

    if (contactSelectionCriteria) {
      await companyContactsController.filterContactsBySelectionCriteria({
        companyId: userUpdates.company || currentUser.company._id,
        contactSelectionCriteria,
      });
    }
  }

  promises.push(
    User.findByIdAndUpdate(currentUser._id, userUpdates, { new: true })
  );

  const result = await Promise.all(promises);

  return result[promises.length - 1];
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

const readAllUsersUnderACompany = async ({ companyId }) =>
  User.find({
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

const deleteUserUnderACompany = async ({ companyId, currentUser, userId }) => {
  basicUtil.validateObjectId({ inputString: userId });

  if (
    currentUser.kind !== USER_KIND.PRIMARY ||
    currentUser._id.toString() === userId
  ) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.NO_RIGHTS,
    });
  }

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
  const emailsSentController = require("./emails-sent.controller");

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
    CompanyContact.countDocuments({
      public_circles_company: companyId,
      public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    }),
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

const readPrimaryUserByCompanyId = ({ companyId }) =>
  User.findOne({ company: companyId, kind: USER_KIND.PRIMARY }).lean();

const addCompanyLogo = async ({ companyLogo, currentUser }) => {
  if (!companyLogo) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_LOGO_REQUIRED,
    });
  }
  const companyLogoUrl = await s3Util.uploadImageToS3({
    s3Path: `company-logo/${currentUser.company._id}/logo.png`,
    buffer: companyLogo.buffer,
  });
  await Company.updateOne(
    { _id: currentUser.company._id },
    { logo: companyLogoUrl }
  );
  return companyLogoUrl;
};

const deleteCompanyLogo = async ({ currentUser }) => {
  await s3Util.deleteFileFromS3(
    `company-logo/${currentUser.company._id}/logo.png`
  );
  await Company.updateOne({ _id: currentUser.company._id }, { logo: "" });
};

const skipTour = async ({ currentUser }) => {
  await User.findOneAndUpdate(
    { _id: currentUser._id },
    {
      $set: {
        "tourSteps.isSkipped": true,
      },
    }
  );
};

const completeTour = async ({ currentUser }) => {
  await User.findOneAndUpdate(
    { _id: currentUser._id },
    {
      $set: {
        "tourSteps.isCompleted": true,
      },
    }
  );
};

const resetTour = async ({ currentUser }) => {
  await User.findOneAndUpdate(
    { _id: currentUser._id },
    {
      $set: {
        "tourSteps.isCompleted": false,
        "tourSteps.isSkipped": false,
      },
    }
  );
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
  readCurrentUser,
  readPrimaryUserByCompanyId,
  addCompanyLogo,
  deleteCompanyLogo,
  skipTour,
  completeTour,
  resetTour
};
