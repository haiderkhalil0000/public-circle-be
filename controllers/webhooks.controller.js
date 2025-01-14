const _ = require("lodash");

const { CompanyUser, Plan, Company, OverageConsumption } = require("../models");
const { basicUtil } = require("../utils");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const createOverageConsumptionEntry = async ({
  companyId,
  customerId,
  description,
  contactOverage,
  contactOverageCharge,
  stripeInvoiceItemId,
}) => {
  await OverageConsumption.create({
    company: companyId,
    customerId: customerId,
    description,
    contactOverage,
    contactOverageCharge,
    kind: OVERAGE_CONSUMPTION_KIND.PRIVATE,
    stripeInvoiceItemId,
  });
};

const recieveCompanyUsersData = async ({ companyId, customerId, users }) => {
  const stripeController = require("./stripe.controller");

  const promises = [];

  users = basicUtil.fiterUniqueObjectsFromArray(users);

  const { getPossibleFilterKeys } = require("./company-users.controller");

  const [possibleFilterKeys, existingContactsCount] = await Promise.all([
    getPossibleFilterKeys({
      companyId,
    }),
    CompanyUser.countDocuments({ company: companyId }),
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

  promises.push(stripeController.readPlanIds({ customerId }));

  const results = await Promise.all(promises);

  const planIds = results[results.length - 1];

  const [
    company,
    plan,
    pendingInvoiceItems,
    paidInvoices,
    latestPrivateOverageConsumption,
  ] = await Promise.all([
    Company.findById(companyId).populate("stripe"),
    Plan.findById(planIds[0].planId),
    stripeController.readPendingInvoiceItems({ customerId }),
    stripeController.readPaidInvoices({ customerId }),
    overageConsumptionController.readLatestPrivateOverageConsumption({
      companyId: company._id,
    }),
  ]);

  if (plan.quota.contacts < users.length + existingContactsCount) {
    const contactsAboveQuota =
      users.length + existingContactsCount - plan.quota.contacts;

    const { contacts, priceInSmallestUnit } = plan.bundles.contact;

    const extraContactsQuotaCharge =
      Math.ceil(contactsAboveQuota / contacts) * priceInSmallestUnit;

    let contactsOverageInvoiceItem = pendingInvoiceItems.data.find(
      (item) => item.description === "Contacts import overage charges."
    );

    let isItemFound = false;

    if (!contactsOverageInvoiceItem) {
      for (const invoice of paidInvoices.data) {
        const lineItems = await stripeController.readInvoiceLineItems({
          invoiceId: invoice.id,
        });

        for (const item of lineItems.data) {
          if (
            item.description === "Contacts import overage charges." &&
            item.invoice_item ===
              latestPrivateOverageConsumption.stripeInvoiceItemId
          ) {
            contactsOverageInvoiceItem = item;
            isItemFound = true;
            break;
          }
        }

        if (isItemFound) {
          break;
        }
      }
    }

    let pendingInvoiceItem = {};

    if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount < extraContactsQuotaCharge
    ) {
      await stripeController.deleteInvoiceItem({
        invoiceItemId: contactsOverageInvoiceItem.id,
      });

      pendingInvoiceItem = await stripeController.createPendingInvoiceItem({
        customerId: company.stripe.id,
        chargeAmountInSmallestUnit: extraContactsQuotaCharge,
      });

      createOverageConsumptionEntry({
        companyId: company._id,
        customerId: company.stripe.id,
        description: "Overage charge for importing contacts above quota.",
        contactOverage: `${contactsAboveQuota} contacts`,
        contactOverageCharge: extraContactsQuotaCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    } else if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount > extraContactsQuotaCharge &&
      isItemFound
    ) {
      pendingInvoiceItem = await stripeController.createPendingInvoiceItem({
        customerId: company.stripe.id,
        chargeAmountInSmallestUnit: extraContactsQuotaCharge,
      });

      createOverageConsumptionEntry({
        companyId: company._id,
        customerId: company.stripe.id,
        description: "Overage charge for importing contacts above quota.",
        contactOverage: `${contactsAboveQuota} contacts`,
        contactOverageCharge: extraContactsQuotaCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    }
  } else {
    pendingInvoiceItem = await stripeController.createPendingInvoiceItem({
      customerId: company.stripe.id,
      chargeAmountInSmallestUnit: extraContactsQuotaCharge,
    });

    createOverageConsumptionEntry({
      companyId: company._id,
      customerId: company.stripe.id,
      description: "Overage charge for importing contacts above quota.",
      contactOverage: `${contactsAboveQuota} contacts`,
      contactOverageCharge: extraContactsQuotaCharge,
      stripeInvoiceItemId: pendingInvoiceItem.id,
    });
  }
};

const receiveStripeEvents = ({ stripeSignature, body }) => {
  const stripeController = require("./stripe.controller");

  stripeController.readStripeEvent({ stripeSignature, body });
};

module.exports = { recieveCompanyUsersData, receiveStripeEvents };
