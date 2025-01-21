const moment = require("moment");

const { Topup } = require("../models");

const readTopupsByCompanyId = ({ companyId }) =>
  Topup.find({ company: companyId });

const syncTopups = async ({ companyId, stripeCustomerId }) => {
  const stripeController = require("./stripe.controller");

  let [oldTopupIds, topupInvoices] = await Promise.all([
    Topup.distinct("_id", { company: companyId }),
    stripeController.readTopupInvoices({ stripeCustomerId }),
  ]);

  topupInvoices = topupInvoices.map((invoice) => ({
    company: companyId,
    stripeInvoiceId: invoice.id,
    stripeCreatedAt: moment.unix(invoice.created).utc(),
    price: invoice.amount_paid / 100,
  }));

  await Promise.all([
    Topup.insertMany(topupInvoices),
    Topup.deleteMany({ _id: { $in: oldTopupIds } }),
  ]);
};

module.exports = {
  readTopupsByCompanyId,
  syncTopups,
};
