const { OverageConsumption } = require("../models");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const readLatestPrivateOverageConsumption = async ({ companyId, customerId }) =>
  OverageConsumption.findOne({
    company: companyId,
    customerId,
    kind: OVERAGE_CONSUMPTION_KIND.PRIVATE,
  })
    .sort({ createdAt: -1 })
    .lean();

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
