const { Company } = require("../models");

const readCompanyById = ({ companyId }) => Company.findById(companyId).lean();

module.exports = {
  readCompanyById,
};
