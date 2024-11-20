const _ = require("lodash");

const { CompanyUser } = require("../models");
const { basicUtil } = require("../utils");

const recieveEmailEvents = () => {};

const recieveCompanyUsersData = async ({ companyId, users }) => {
  const promises = [];

  users = basicUtil.fiterUniqueObjectsFromArray(users);

  const { getPossibleFilterKeys } = require("./company-users.controller");

  const possibleFilterKeys = await getPossibleFilterKeys({
    companyId,
  });

  const filterKeys = {};

  for (const key of possibleFilterKeys) {
    filterKeys[key] = {};
  }

  let query = {};

  for (const user of users) {
    query = { ...filterKeys, companyId };

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

      const newItemKeysCount = Object.keys(users[index]);

      if (existingItemKeysCount.length !== newItemKeysCount.length) {
        const newKeys = _.difference(newItemKeysCount, existingItemKeysCount);

        const updateQuery = {};

        newKeys.forEach((key) => {
          updateQuery[key] = users[index][key];
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
          companyId,
          ...users[index],
        })
      );
    }
  });

  await Promise.all(promises);
};

module.exports = { recieveEmailEvents, recieveCompanyUsersData };
