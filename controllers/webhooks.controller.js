const _ = require("lodash");

const recieveCompanyContacts = async ({ companyId, contacts }) => {
  const companyContactsController = require("./company-contacts.controller");

  contacts = contacts.map((item) => ({ ...item, company: companyId }));

  await companyContactsController.createMultipleCompanyContacts({ contacts });
};

const receiveStripeEvents = ({ stripeSignature, body }) => {
  const stripeController = require("./stripe.controller");

  stripeController.readStripeEvent({ stripeSignature, body });
};

module.exports = { recieveCompanyContacts, receiveStripeEvents };
