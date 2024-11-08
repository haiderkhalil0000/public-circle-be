const { User, Company } = require("../models");

const updateUser = async ({
  emailAddress,
  password,
  firstName,
  lastName,
  companyName,
  phoneNumber,
  secondaryEmail,
  noOfEmployees,
  address,
  postalCode,
  city,
  province,
  country,
  currentUserId,
}) => {
  let companyDoc;
  const promises = [];

  if (companyName) {
    companyDoc = await Company.findOne({
      name: companyName,
      user: currentUserId,
    });

    if (companyDoc) {
      promises.push((companyDoc.name = companyName));
    } else {
      companyDoc = await Company.create({
        name: companyName,
        user: currentUserId,
      });
    }
  }

  if (noOfEmployees || address || postalCode || city || province || country) {
    promises.push(
      Company.updateOne(
        { user: currentUserId },
        { noOfEmployees, postalCode, city, province, country }
      )
    );
  }

  promises.push(
    User.updateOne(
      { _id: currentUserId },
      {
        emailAddress,
        password,
        firstName,
        lastName,
        phoneNumber,
        secondaryEmail,
      }
    )
  );

  await Promise.all(promises);
};

module.exports = {
  updateUser,
};
