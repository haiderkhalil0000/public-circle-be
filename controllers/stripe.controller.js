const { STRIPE_KEY } = process.env;

const stripe = require("stripe")(STRIPE_KEY);

const createPaymentIntent = ({ amount }) =>
  stripe.paymentIntents.create({
    amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

const getSubscriptions = async ({ pageSize }) => {
  const { data } = await stripe.subscriptions.list({
    limit: pageSize,
  });

  return data;
};
module.exports = {
  createPaymentIntent,
  getSubscriptions,
};
