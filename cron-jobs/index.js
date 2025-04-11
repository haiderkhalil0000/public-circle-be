module.exports = {
  runCampaign: require("./run-campaign.cron"),
  stripeInvoice: require("./stripe-invoice.cron"),
};
