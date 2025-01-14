const { OverageConsumption } = require("../models");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const readLatestPrivateOverageConsumption = async ({
  companyId,
  customerId,
}) => {
  const query = {
    kind: OVERAGE_CONSUMPTION_KIND.PRIVATE,
  };
  if (companyId) {
    query.companyId = companyId;
  } else {
    query.customerId = customerId;
  }

  return OverageConsumption.findOne(query).sort({ createdAt: -1 }).lean();
};

const createOverageConsumption = async ({
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
module.exports = {
  createOverageConsumption,
  readLatestPrivateOverageConsumption,
};
