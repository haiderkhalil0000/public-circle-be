const { OverageConsumption } = require("../models");
const { OVERAGE_CONSUMPTION_KIND } = require("../utils/constants.util");

const readLatestPrivateOverageConsumption = ({ companyId }) =>
  OverageConsumption.findOne(
    {
      company: companyId,
      kind: OVERAGE_CONSUMPTION_KIND.PRIVATE,
    },
    {},
    { createdAt: -1 }
  );

module.exports = {
  readLatestPrivateOverageConsumption,
};
