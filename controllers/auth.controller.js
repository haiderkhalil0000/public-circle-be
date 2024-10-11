const createError = require("http-errors");
const moment = require("moment");

const { User } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const register = async ({
  company,
  emailAddress,
  password,
  firstName,
  lastName,
}) => {
  const user = await User.findOne({ emailAddress });

  if (user) {
    throw createError(400, {
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
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
    });
  }

  if (user.password !== password) {
    if (user.invalidLoginAttempts > 5) {
      user.invalidLoginAttempts = user.invalidLoginAttempts + 1;
      user.isLoginWithEmailLocked = true;

      user.save();

      throw createError(403, { errorMessage: TOO_MANY_INVALID_LOGIN_ATTEMTPS });
    }

    user.invalidLoginAttempts = user.invalidLoginAttempts + 1;

    user.save();

    throw createError(403, {
      errorMessage: RESPONSE_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
    });
  }

  user.invalidLoginAttempts = 0;
  user.lastLoginAt = moment().format();

  user.save();

  return user;
};

module.exports = {
  register,
  login,
};
