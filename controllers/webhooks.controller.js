const _ = require("lodash");
const createHttpError = require("http-errors");

const { CompanyUser, AccessToken } = require("../models");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");
const { basicUtil } = require("../utils");

const recieveEmailEvents = () => {};

const recieveCompanyUsersData = async ({ accessToken, companyUsersData }) => {
  const promises = [];

  const { decodeToken } = require("../middlewares/authenticator.middleware");

  accessToken = decodeToken(accessToken);
  companyUsersData = basicUtil.fiterUniqueObjectsFromArray(companyUsersData);

  const accessTokenDoc = await AccessToken.findById(accessToken._id);

  if (!accessTokenDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_TOKEN,
    });
  }

  const { getPossibleFilterKeys } = require("./company-users.controller");

  const possibleFilterKeys = await getPossibleFilterKeys({
    companyId: accessTokenDoc.companyId,
  });

  const filterKeys = {};

  for (const key of possibleFilterKeys) {
    filterKeys[key] = {};
  }

  let query = {};

  for (const user of companyUsersData) {
    query = { ...filterKeys, companyId: accessTokenDoc.companyId };

    for (const key in user) {
      if (possibleFilterKeys.includes(key)) {
        query[key] = user[key];
      }
    }

    query = _.pickBy(query, (value) => !_.isEmpty(value));
    promises.push(CompanyUser.find(query));
  }

  const resultsArray = await Promise.all(promises);

  promises.length = 0;

  resultsArray.forEach((item, index) => {
    if (item.length) {
      const existingItemKeysCount = Object.keys(item[0]).filter(
        (item) => item !== "$__" && item !== "_doc" && item !== "$isNew"
      );

      const newItemKeysCount = Object.keys(companyUsersData[index]);

      if (existingItemKeysCount.length !== newItemKeysCount.length) {
        const newKeys = _.difference(newItemKeysCount, existingItemKeysCount);

        const updateQuery = {};

        newKeys.forEach((key) => {
          updateQuery[key] = companyUsersData[index][key];
        });

        if (newKeys.length) {
          promises.push(
            CompanyUser.updateOne({ _id: item[0]._id }, updateQuery)
          );
        }
      }
    } else {
      promises.push(
        CompanyUser.create({
          companyId: accessTokenDoc.companyId,
          ...companyUsersData[index],
        })
      );
    }
  });

  await Promise.all(promises);
};

module.exports = { recieveEmailEvents, recieveCompanyUsersData };
