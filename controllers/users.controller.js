const createHttpError = require("http-errors");

const { User, Company } = require("../models");
const { basicUtil } = require("../utils");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const updateUser = async ({
  emailAddress,
  password,
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
}) => {
  let companyDoc;
  const promises = [];
  const userUpdates = {
    emailAddress,
    password,
    firstName,
    lastName,
    phoneNumber,
    secondaryEmail,
    role,
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
      companyDoc = await Company.create({
        name: companyName,
        user: currentUserId,
      });

      userUpdates.company = companyDoc._id;
    }
  }

  if (companySize || address || postalCode || city || province || country) {
    promises.push(
      Company.updateOne(
        { user: currentUserId },
        { companySize, postalCode, city, province, country }
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
}) => {
  basicUtil.validateObjectId({ inputString: role });

  const existingUserDoc = await User.findOne({
    emailAddress,
    company: companyId,
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
      name,
      role,
      company: companyId,
    }),
    authController.sendVerificationEmail({ emailAddress }),
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

const readAllUsersUnderACompany = async ({ companyId }) =>
  User.find({
    company: companyId,
  });

module.exports = {
  updateUser,
  createUserUnderACompany,
  readPaginatedUsersUnderACompany,
  readAllUsersUnderACompany,
};
