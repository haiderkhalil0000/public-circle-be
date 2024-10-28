const { CompanyUser } = require("../models");

const recieveEmailEvents = () => {};

const recieveCompanyUsersData = async ({ companyId, companyUsersData }) => {
  const promises = [];

  for (const user of companyUsersData) {
    promises.push(CompanyUser.create({ companyId, ...user }));
  }

  await Promise.all(promises);
};

module.exports = { recieveEmailEvents, recieveCompanyUsersData };
