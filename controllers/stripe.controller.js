const createHttpError = require("http-errors");

const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const { STRIPE_KEY } = process.env;

const stripe = require("stripe")(STRIPE_KEY);

const createStripeCustomer = async ({ companyName, companyId }) =>
  stripe.customers.create({
    name: companyName,
    metadata: {
      companyId: companyId,
    },
  });

const createPaymentIntent = ({ customerId, amount }) =>
  stripe.paymentIntents.create({
    amount,
    currency: "usd",
    customer: customerId,
    payment_method_types: ["card"],
  });

const getSubscriptions = async ({ pageSize }) => {
  const { data } = await stripe.subscriptions.list({
    limit: pageSize,
  });

  return data;
};

const getActiveSubscriptionsOfACustomer = async ({ customerId }) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  if (subscriptions.data.length > 0) {
    return subscriptions.data;
  } else {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.NO_SUBSCRIPTION_FOUND,
    });
  }
};

const getPlans = async ({ pageSize }) => {
  const promises = [];

  const plans = await stripe.products.list({
    limit: pageSize,
  });

  plans.data.forEach((item) => {
    promises.push(stripe.prices.retrieve(item.default_price));
  });

  const prices = await Promise.all(promises);

  plans.data.forEach((item, index) => {
    item.price = prices[index];
  });

  return plans.data;
};

const createSubscription = async ({ stripeCustomerId, items }) => {
  await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items,
  });
};

const attachPaymentMethod = async ({ stripeCustomerId, paymentMethodId }) => {
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: stripeCustomerId,
  });

  const customer = await stripe.customers.update(stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  console.log("Payment method attached and set as default:", customer);
};

module.exports = {
  createStripeCustomer,
  createPaymentIntent,
  getSubscriptions,
  getActiveSubscriptionsOfACustomer,
  getPlans,
  createSubscription,
  attachPaymentMethod,
};
