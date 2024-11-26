const createHttpError = require("http-errors");
const moment = require("moment");
const axios = require("axios");

const { User } = require("../models");
const {
  createToken,
  decodeToken,
} = require("../middlewares/authenticator.middleware");
const {
  constants: {
    RESPONSE_MESSAGES,
    VERIFICATION_EMAIL_SUBJECT,
    TEMPLATE_CONTENT_TYPE,
    PASSWORD_RESET_SUBJECT,
    PASSWORD_RESET_CONTENT,
  },
  sesUtil,
} = require("../utils");

const {
  BEEFREE_CLIENT_ID,
  BEEFREE_CLIENT_SECRET,
  PUBLIC_CIRCLES_WEB_URL,
  PUBLIC_CIRCLES_EMAIL_ADDRESS,
} = process.env;

const register = async ({ emailAddress, password }) => {
  const user = await User.findOne({ emailAddress });

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  return User.create({
    emailAddress,
    password,
  });
};

const login = async ({ emailAddress, password }) => {
  const user = await User.findOne({
    emailAddress,
  });

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
        errorMessage: TOO_MANY_INVALID_LOGIN_ATTEMTPS,
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

  return user;
};

const sendVerificationEmail = async ({ emailAddress }) => {
  const user = await User.findOne({ emailAddress, isEmailVerified: true });

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  const token = createToken({ emailAddress });

  await Promise.all([
    // User.create({ emailAddress }),
    sesUtil.sendEmail({
      fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
      toEmailAddress: emailAddress,
      subject: VERIFICATION_EMAIL_SUBJECT,
      content: `Welcome to Public Circles,

Please verify your email address by using the following link:
${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/sign-up/?token=${token}

Regards,
Public Circles Team`,
      contentType: TEMPLATE_CONTENT_TYPE.TEXT,
    }),
  ]);
};

const verifyJwtToken = async ({ token, source }) => {
  try {
    const decodedToken = decodeToken(token);

    if (!decodedToken.emailAddress) {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    }

    // const result = await User.findOneAndUpdate(
    //   { emailAddress: decodedToken.emailAddress },
    //   { isEmailVerified: true }
    // );

    // if (!result.matchedCount) {
    //   throw createHttpError(404, {
    //     errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
    //   });
    // }

    if (source === "reset-password") {
      const userDoc = await User.findOne({
        emailAddress: decodedToken.emailAddress,
        isResetPasswordRequested: true,
      });

      if (!userDoc) {
        throw createHttpError(403, {
          errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
        });
      }

      return decodedToken;
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    } else if (err.name === "JsonWebTokenError") {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    } else {
      throw { errorMessage: err.message };
    }
  }
};

const getBeefreeAccessToken = async ({ currentUserId }) => {
  const {
    data: { access_token },
  } = await axios.post("https://auth.getbee.io/loginV2", {
    client_id: BEEFREE_CLIENT_ID,
    client_secret: BEEFREE_CLIENT_SECRET,
    uid: currentUserId,
  });

  return access_token;
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
        url: `${PUBLIC_CIRCLES_WEB_URL}/auth/jwt/reset-password/?token=${createToken(
          { emailAddress: userDoc.emailAddress }
        )}`,
      }),
      contentType: TEMPLATE_CONTENT_TYPE.HTML,
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

module.exports = {
  register,
  login,
  sendVerificationEmail,
  verifyJwtToken,
  getBeefreeAccessToken,
  changePassword,
  forgotPassword,
  resetPassword,
};
