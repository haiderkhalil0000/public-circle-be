const _ = require("lodash");

const recieveCompanyContacts = async ({ companyId, contacts }) => {
  const companyContactsController = require("./company-contacts.controller");
  const primaryKey = await companyContactsController.readPrimaryKey({
    companyId,
  });

  if (primaryKey) {
    for (const contact of contacts) {
      const primaryKeyValue = contact[primaryKey];

      if (primaryKeyValue) {
        const existingContacts =
          await companyContactsController.findContactsByPrimaryKey({
            companyId,
            primaryKey,
            primaryKeyValue,
          });

        if (existingContacts && existingContacts.length > 0) {
          const latestContact = existingContacts.reduce((latest, current) => {
            const latestDate = new Date(
              latest.public_circles_updatedAt || latest.public_circles_createdAt
            );
            const currentDate = new Date(
              current.public_circles_updatedAt ||
                current.public_circles_createdAt
            );
            return currentDate > latestDate ? current : latest;
          });
          delete contact.public_circles_is_unsubscribed;
          await companyContactsController.updateCompanyContact({
            companyId,
            userId: latestContact._id.toString(),
            companyUserData: contact,
          });
        } else {
          await companyContactsController.createCompanyContact({
            companyId,
            companyUserData: contact,
          });
        }
      } else {
        await companyContactsController.createCompanyContact({
          companyId,
          companyUserData: contact,
        });
      }
    }
  } else {
    contacts = contacts.map((item) => ({
      ...item,
      public_circles_company: companyId,
    }));

    await companyContactsController.createMultipleCompanyContacts({ contacts });
  }
};

const receiveStripeEvents = ({ stripeSignature, body }) => {
  const stripeController = require("./stripe.controller");

  stripeController.readStripeEvent({ stripeSignature, body });
};

module.exports = { recieveCompanyContacts, receiveStripeEvents };
