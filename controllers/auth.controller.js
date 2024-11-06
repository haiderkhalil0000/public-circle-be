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
    PUBLIC_CIRCLES_EMAIL_ADDRESS,
  },
  sesUtil,
} = require("../utils");
const createHttpError = require("http-errors");

const { PUBLIC_CIRCLES_WEB_URL } = process.env;

const { BEEFREE_CLIENT_ID, BEEFREE_CLIENT_SECRET } = process.env;

const register = async ({
  company,
  emailAddress,
  password,
  firstName,
  lastName,
}) => {
  const user = await User.findOne({ emailAddress });

  if (user) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_BELONGS_TO_OTHER,
    });
  }

  return User.create({
    company,
    emailAddress,
    password,
    firstName,
    lastName,
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
  const token = createToken({ emailAddress });

  await sesUtil.sendEmail({
    fromEmailAddress: PUBLIC_CIRCLES_EMAIL_ADDRESS,
    toEmailAddress: emailAddress,
    subject: VERIFICATION_EMAIL_SUBJECT,
    content: `Welcome to Public Circles,

Please verify your email address by using the following link:
${PUBLIC_CIRCLES_WEB_URL}/email-verification?emailAddress=${emailAddress}&token=${token}

Regards,
Public Circles Team`,
  });
};

const verifyEmailAddress = async ({ emailAddress, token }) => {
  try {
    const decodedToken = decodeToken(token);

    if (decodedToken.emailAddress !== emailAddress) {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    } else {
      throw err;
    }
  }
  
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

module.exports = {
  register,
  login,
  sendVerificationEmail,
  verifyEmailAddress,
  getBeefreeAccessToken,
};
