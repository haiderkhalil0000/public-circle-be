const _ = require("lodash");

const { CompanyContact } = require("../models");

const recieveCompanyContacts = async ({ companyId, users }) => {
  const promises = [];

  const companyContactsController = require("./company-contacts.controller");

  const possibleFilterKeys = await companyContactsController.readContactKeys({
    companyId,
  });

  const filterKeys = {};

  for (const key of possibleFilterKeys) {
    filterKeys[key] = {};
  }

  let query = {};

  for (const user of users) {
    query = { ...filterKeys, company: companyId };

    for (const key in user) {
      if (possibleFilterKeys.includes(key)) {
        query[key] = user[key];
      }
    }

    query = _.pickBy(query, (value) => !_.isEmpty(value));
    promises.push(CompanyContact.find(query));
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
            CompanyContact.updateOne({ _id: item[0]._id }, updateQuery)
          );
        }
      }
    } else {
      promises.push(
        CompanyContact.create({
          company: companyId,
          ...users[index],
        })
      );
    }
  });

  await Promise.all(promises);
};

const receiveStripeEvents = ({ stripeSignature, body }) => {
  const stripeController = require("./stripe.controller");

  stripeController.readStripeEvent({ stripeSignature, body });
};

module.exports = { recieveCompanyContacts, receiveStripeEvents };
