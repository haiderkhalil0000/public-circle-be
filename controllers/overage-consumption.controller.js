const { OverageConsumption } = require("../models");
const {
  constants: { OVERAGE_KIND },
} = require("../utils");

const readLatestPrivateOverageConsumption = async ({
  companyId,
  stripeCustomerId,
}) => {
  const query = {
    kind: OVERAGE_KIND.CONTACT,
  };
  if (companyId) {
    query.companyId = companyId;
  } else {
    query.stripeCustomerId = stripeCustomerId;
  }

  return OverageConsumption.findOne(query).sort({ createdAt: -1 }).lean();
};

const createOverageConsumption = async ({
  companyId,
  stripeCustomerId,
  description,
  contactOverage,
  contactOverageCharge,
  stripeInvoiceItemId,
}) => {
  await OverageConsumption.create({
    company: companyId,
    stripeCustomerId: stripeCustomerId,
    description,
    overage: contactOverage,
    overageCharge: contactOverageCharge,
    kind: OVERAGE_KIND.CONTACT,
    stripeInvoiceItemId,
  });
};

const readEmailOverage = ({
  companyId,
  billingCycleStartDate,
  billingCycleEndDate,
}) =>
  OverageConsumption.find({
    company: companyId,
    kind: OVERAGE_KIND.COMMUNICATION,
    createdAt: {
      $gte: billingCycleStartDate,
      $lt: billingCycleEndDate,
    },
  });

const readEmailContentOverage = ({
  companyId,
  billingCycleStartDate,
  billingCycleEndDate,
}) =>
  OverageConsumption.find({
    company: companyId,
    kind: OVERAGE_KIND.BANDWIDTH,
    createdAt: {
      $gte: billingCycleStartDate,
      $lt: billingCycleEndDate,
    },
  });

module.exports = {
  createOverageConsumption,
  readLatestPrivateOverageConsumption,
  readEmailOverage,
  readEmailContentOverage,
};
