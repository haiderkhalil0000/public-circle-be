const { Company } = require("../models");

const readCompanyById = ({ companyId }) => Company.findById(companyId);

module.exports = {
  readCompanyById,
};
