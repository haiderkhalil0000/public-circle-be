const { OverageConsumption } = require("../models");
const {
  constants: { OVERAGE_KIND },
} = require("../utils");

const readLatestPrivateOverageConsumption = async ({
  companyId,
  customerId,
}) => {
  const query = {
    kind: OVERAGE_KIND.CONTACT,
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
    overage: contactOverage,
    overageCharge: contactOverageCharge,
    kind: OVERAGE_KIND.CONTACT,
    stripeInvoiceItemId,
  });
};
module.exports = {
  createOverageConsumption,
  readLatestPrivateOverageConsumption,
};
