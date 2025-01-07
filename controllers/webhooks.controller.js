const _ = require("lodash");

const { CompanyUser, Company } = require("../models");
const { basicUtil } = require("../utils");

const { EXTRA_CONTACTS_QUOTA, EXTRA_CONTACTS_CHARGE } = process.env;

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
    query = { ...filterKeys, company: companyId };

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
          company: companyId,
          ...users[index],
        })
      );
    }
  });

  promises.push(Company.findById(companyId).populate("plan").lean());

  const results = await Promise.all(promises);

  const company = results[results.length - 1];

  if (company.plan.quota.contacts < users.length) {
    const stripeController = require("./stripe.controller");

    const emailsContactsAboveQuota = users.length - company.plan.quota.contacts;

    const extraContactsQuotaCharge =
      Math.ceil(emailsContactsAboveQuota / EXTRA_CONTACTS_QUOTA) *
      EXTRA_CONTACTS_CHARGE;

    await stripeController.chargeInUpcomingInvoice({
      customerId: company.stripe.id,
      chargeAmountInSmallestUnit: extraContactsQuotaCharge,
    });
  }
};

module.exports = { recieveEmailEvents, recieveCompanyUsersData };
