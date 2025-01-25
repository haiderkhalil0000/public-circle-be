const _ = require("lodash");

const { CompanyContact, Plan, Company } = require("../models");
const { basicUtil } = require("../utils");

const recieveCompanyUsersData = async ({
  companyId,
  stripeCustomerId,
  users,
}) => {
  const stripeController = require("./stripe.controller");
  const overageConsumptionController = require("./overage-consumption.controller");

  const promises = [];

  users = basicUtil.fiterUniqueObjectsFromArray(users);

  const companyContactsController = require("./company-contacts.controller");

  const [possibleFilterKeys, existingContactsCount] = await Promise.all([
    companyContactsController.readContactKeys({
      companyId,
    }),
    CompanyContact.countDocuments({ company: companyId }),
  ]);

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

  promises.push(stripeController.readPlanIds({ stripeCustomerId }));

  const results = await Promise.all(promises);

  const planIds = results[results.length - 1];

  const [company, plan, pendingInvoiceItems] = await Promise.all([
    Company.findById(companyId),
    Plan.findById(planIds[0].planId),
    stripeController.readPendingInvoiceItems({ stripeCustomerId }),
  ]);

  if (plan.quota.contacts < users.length + existingContactsCount) {
    const contactsAboveQuota =
      users.length + existingContactsCount - plan.quota.contacts;

    const { contacts, price } = plan.bundles.contact;

    const extraContactsQuotaCharge =
      Math.ceil(contactsAboveQuota / contacts) * price;

    let contactsOverageInvoiceItem = pendingInvoiceItems.data.find(
      (item) => item.description === "Contacts import overage charges."
    );

    let pendingInvoiceItem = {};

    if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount < extraContactsQuotaCharge
    ) {
      await stripeController.deleteInvoiceItem({
        invoiceItemId: contactsOverageInvoiceItem.id,
      });

      pendingInvoiceItem = await stripeController.createPendingInvoiceItem({
        stripeCustomerId: company.stripeCustomerId,
        price: extraContactsQuotaCharge,
      });

      overageConsumptionController.createOverageConsumption({
        companyId: company._id,
        stripeCustomerId: company.stripeCustomerId,
        description: "Overage charge for importing contacts above quota.",
        overageCount: `${contactsAboveQuota} contacts`,
        overagePrice: extraContactsQuotaCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    } else if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount > extraContactsQuotaCharge
    ) {
      //do nothing
    } else {
      pendingInvoiceItem = await stripeController.createPendingInvoiceItem({
        stripeCustomerId: company.stripeCustomerId,
        price: extraContactsQuotaCharge,
      });

      overageConsumptionController.createOverageConsumption({
        companyId: company._id,
        stripeCustomerId: company.stripeCustomerId,
        description: "Overage charge for importing contacts above quota.",
        contactOverage: `${contactsAboveQuota} contacts`,
        contactOverageCharge: extraContactsQuotaCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    }
  }
};

const receiveStripeEvents = ({ stripeSignature, body }) => {
  const stripeController = require("./stripe.controller");

  stripeController.readStripeEvent({ stripeSignature, body });
};

module.exports = { recieveCompanyUsersData, receiveStripeEvents };
