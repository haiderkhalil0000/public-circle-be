const { STRIPE_KEY } = process.env;

const stripe = require("stripe")(STRIPE_KEY);

const createPaymentIntent = ({ amount }) =>
  stripe.paymentIntents.create({
    amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

module.exports = {
  createPaymentIntent,
};
