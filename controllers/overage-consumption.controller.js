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

const readEmailAndContentOverageConsumptions = ({ companyId }) =>
  OverageConsumption.find({
    company: companyId,
    kind: { $ne: OVERAGE_KIND.CONTACT },
  }).lean();

module.exports = {
  createOverageConsumption,
  readLatestPrivateOverageConsumption,
  readEmailAndContentOverageConsumptions,
};
