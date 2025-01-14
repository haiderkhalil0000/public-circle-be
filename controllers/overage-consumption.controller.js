const { OverageConsumption } = require("../models");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const readLatestPrivateOverageConsumption = async ({ companyId }) =>
  OverageConsumption.findOne({
    company: companyId,
    kind: OVERAGE_CONSUMPTION_KIND.PRIVATE,
  })
    .sort({ createdAt: -1 })
    .lean();

module.exports = {
  readLatestPrivateOverageConsumption,
};
