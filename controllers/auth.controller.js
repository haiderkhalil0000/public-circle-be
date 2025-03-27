const createHttpError = require("http-errors");
const moment = require("moment");

const { User, EmailSent } = require("../models");
const {
  generateAccessToken,
  decodeToken,
} = require("../middlewares/authenticator.middleware");
const {
  constants: {
    RESPONSE_MESSAGES,
    VERIFICATION_EMAIL_SUBJECT,
    TEMPLATE_CONTENT_TYPE,
    PASSWORD_RESET_SUBJECT,
    PASSWORD_RESET_CONTENT,
    EMAIL_KIND,
    USER_STATUS,
    ERROR_CODES,
  },
  sesUtil,
} = require("../utils");

const {
  PUBLIC_CIRCLES_WEB_URL,
  PUBLIC_CIRCLES_EMAIL_ADDRESS,
  ACCESS_TOKEN_EXPIRY,
} = process.env;

const register = async ({ emailAddress, password }) => {
  const user = await User.findOne({ emailAddress, isEmailVerified: true });

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  return User.create({
    emailAddress,
    password,
    isEmailVerified: true,
  });
};

const login = async ({ emailAddress, password }) => {
  const user = await User.findOne({
    emailAddress,
    status: USER_STATUS.ACTIVE,
  }).populate("company");

  if (!user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
    });
  }

  if (user.password !== password) {
    if (user.invalidLoginAttempts > 5) {
      user.invalidLoginAttempts = user.invalidLoginAttempts + 1;
      user.isLoginWithEmailLocked = true;

      user.save();

      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOO_MANY_INVALID_LOGIN_ATTEMTPS,
      });
    }

    user.invalidLoginAttempts = user.invalidLoginAttempts + 1;

    user.save();

    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
    });
  }

  user.invalidLoginAttempts = 0;
  user.lastLoginAt = moment().format();

  user.save();

  const topupController = require("./topup.controller");

  topupController.syncTopups({
    companyId: user?.company?._id,
    stripeCustomerId: user?.company?.stripeCustomerId,
  });

  return user;
};

const sendVerificationEmail = async ({ emailAddress }) => {
  const user = await User.findOne({ emailAddress, isEmailVerified: true });

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  const token = generateAccessToken({
    payload: { emailAddress },
    options: { expiresIn: ACCESS_TOKEN_EXPIRY },
  });

  const emailSent = await sesUtil.sendEmail({
    fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
    toEmailAddress: emailAddress,
    subject: VERIFICATION_EMAIL_SUBJECT,
    content: `Welcome to Public Circles,

Please verify your email address by using the following link:
${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/sign-up/?source=register&token=${token}

Regards,
Public Circles Team`,
    contentType: TEMPLATE_CONTENT_TYPE.TEXT,
  });

  EmailSent.create({
    kind: EMAIL_KIND.VERIFICATION,
    fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
    toEmailAddress: emailAddress,
    emailSubject: VERIFICATION_EMAIL_SUBJECT,
    emailContent: `Welcome to Public Circles,

Please verify your email address by using the following link:
${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/sign-up/?source=register&token=${token}

Regards,
Public Circles Team`,
    sesMessageId: emailSent.MessageId,
  });
};

const verifyJwtToken = async ({ token, source }) => {
  try {
    const decodedToken = decodeToken(token);

    if (!decodedToken.emailAddress) {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    }
    if (source !== "reset-password") {
      await User.findOneAndUpdate(
        { emailAddress: decodedToken.emailAddress },
        { isEmailVerified: true, signUpStepsCompleted: 2 }
      );
    } else {
      const userDoc = await User.findOne({
        emailAddress: decodedToken.emailAddress,
        isResetPasswordRequested: true,
      });

      if (!userDoc) {
        throw createHttpError(403, {
          errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
          errorCode: ERROR_CODES.LINK_EXPIRED,
        });
      }
      return decodedToken;
    }
  } catch (err) {
    if (
      err.message === "TokenExpiredError" ||
      err.message === "JsonWebTokenError" ||
      err.message === "Forbidden"
    ) {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
        errorCode: ERROR_CODES.LINK_EXPIRED,
      });
    }
    throw { errorMessage: err.message || "An error occurred" };
  }
};

const changePassword = async ({ currentUserId, oldPassword, newPassword }) => {
  const userDoc = await User.findById(currentUserId);

  if (!userDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.USER_NOT_FOUND,
    });
  }

  if (userDoc.password !== oldPassword) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.PASSWORD_INVALID,
    });
  }

  userDoc.password = newPassword;

  await userDoc.save();
};

const mapDynamicValues = ({ content, firstName, url }) =>
  content.replace(/{{firstName}}/g, firstName).replace(/{{reset-url}}/g, url);

const forgotPassword = async ({ emailOrPhoneNumber }) => {
  const userDoc = await User.findOne({
    $or: [
      { emailAddress: emailOrPhoneNumber },
      { phoneNumber: emailOrPhoneNumber },
    ],
  });

  if (!userDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.USER_NOT_FOUND,
    });
  }

  userDoc.isResetPasswordRequested = true;

  await Promise.all([
    userDoc.save(),
    sesUtil.sendEmail({
      fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
      toEmailAddress: userDoc.emailAddress,
      subject: PASSWORD_RESET_SUBJECT,
      content: mapDynamicValues({
        content: PASSWORD_RESET_CONTENT,
        firstName: userDoc.firstName,
        url: `${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/reset-password/?token=${generateAccessToken(
          {
            payload: { emailAddress: userDoc.emailAddress },
            options: { expiresIn: ACCESS_TOKEN_EXPIRY },
          }
        )}`,
      }),
      contentType: TEMPLATE_CONTENT_TYPE.HTML,
    }),
    EmailSent.create({
      kind: EMAIL_KIND.PASSWORD_RESET,
      fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
      toEmailAddress: userDoc.emailAddress,
      emailSubject: PASSWORD_RESET_SUBJECT,
      emailContent: mapDynamicValues({
        content: PASSWORD_RESET_CONTENT,
        firstName: userDoc.firstName,
        url: `${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/reset-password/?token=${generateAccessToken(
          {
            payload: { emailAddress: userDoc.emailAddress },
            options: { expiresIn: ACCESS_TOKEN_EXPIRY },
          }
        )}`,
      }),
    }),
  ]);
};

const resetPassword = async ({ emailAddress, newPassword }) => {
  const result = await User.updateOne(
    { emailAddress },
    { password: newPassword, isResetPasswordRequested: false }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.PASSWORD_DID_NOT_RESET,
    });
  }
};

const sendInvitationEmail = async ({ emailAddress, currentUserId }) => {
  const [user, currentUser] = await Promise.all([
    User.findOne({ emailAddress, isEmailVerified: true }),
    User.findById(currentUserId).populate("company", "name"),
  ]);

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  const token = generateAccessToken({
    payload: { emailAddress },
    options: { expiresIn: ACCESS_TOKEN_EXPIRY },
  });

  await Promise.all([
    sesUtil.sendEmail({
      fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
      toEmailAddress: emailAddress,
      subject: VERIFICATION_EMAIL_SUBJECT,
      content: `${currentUser.firstName} has invited you to use Public Cricles with them, in a workspace called ${currentUser.company.name}.

Please follow the link below to continue to Public Circles:
${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/sign-up/?source=invite&token=${token}

Regards,
Public Circles Team`,
      contentType: TEMPLATE_CONTENT_TYPE.TEXT,
    }),
    EmailSent.create({
      kind: EMAIL_KIND.INVITATION,
      fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
      toEmailAddress: emailAddress,
      emailSubject: VERIFICATION_EMAIL_SUBJECT,
      emailContent: `${currentUser.firstName} has invited you to use Public Cricles with them, in a workspace called ${currentUser.company.name}.

Please follow the link below to continue to Public Circles:
${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/sign-up/?source=invite&token=${token}

Regards,
Public Circles Team`,
    }),
  ]);
};

module.exports = {
  register,
  login,
  sendVerificationEmail,
  verifyJwtToken,
  changePassword,
  forgotPassword,
  resetPassword,
  sendInvitationEmail,
};
