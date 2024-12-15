const createHttpError = require("http-errors");

const { ReferralCode, User, Reward } = require("../models");
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

const createPaymentIntent = async ({ customerId, items }) => {
  const allPrices = await Promise.all(
    items.map((item) => stripe.prices.retrieve(item.priceId))
  );

  const totalPrice = allPrices
    .map((price) => price.unit_amount || 0)
    .reduce((total, amount) => total + amount, 0);

  return stripe.paymentIntents.create({
    amount: totalPrice,
    currency: "usd",
    customer: customerId,
    payment_method_types: ["card"],
    setup_future_usage: "off_session",
  });
};

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

  const subscriptionsLimited = [];

  if (subscriptions.data.length > 0) {
    // return subscriptions.data;

    for (const subscription of subscriptions.data) {
      for (const item of subscription.items.data) {
        const price = item.price;
        const productId = price.product;

        const product = await stripe.products.retrieve(productId);

        const priceAmount = price.unit_amount / 100;
        const priceCurrency = price.currency.toUpperCase();

        subscriptionsLimited.push({
          productId,
          productName: product.name,
          productPrice: `${priceAmount} ${priceCurrency}`,
        });
      }
    }

    return subscriptionsLimited;
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

const createSubscription = async ({
  currentUserId,
  stripeCustomerId,
  items,
}) => {
  const currentUserDoc = await User.findById(currentUserId, {
    referralCodeConsumed: 1,
  }).populate("referralCodeConsumed");

  if (!currentUserDoc.referralCodeConsumed) {
    return await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items,
      // trial_period_days: trialDays, // Optional: Set the trial period (in days)
      // expand: ["latest_invoice.payment_intent"], // Expand the invoice and payment intent for further processing
    });
  }

  console.log("referralCodeConsumed : ", currentUserDoc.referralCodeConsumed);

  let referralCodeDoc = await ReferralCode.findById(
    currentUserDoc.referralCodeConsumed,
    {
      reward: 1,
    }
  ).populate("reward");

  let reward = {};

  if (referralCodeDoc.reward) {
    reward = referralCodeDoc.reward;
  } else {
    reward = await Reward.findOne({ isGeneric: true });
  }

  console.log("reward : ", reward);

  const phaseStartDate = Math.floor(Date.now() / 1000);
  const phaseEndDate =
    phaseStartDate +
    (reward.trialInDays || reward.discountInDays) * 24 * 60 * 60;

  await stripe.subscriptionSchedules.create({
    customer: stripeCustomerId,
    start_date: Math.floor(Date.now() / 1000), // Start immediately
    end_behavior: "release", // Continue the subscription after the schedule ends
    // payment_behavior: "immediate_payment",
    phases: [
      {
        items,
        coupon: reward.id,
        end_date: phaseEndDate,
      },
      {
        items,
      },
    ],
  });

  console.log("Subscription created");
};

const attachPaymentMethod = async ({ stripeCustomerId, paymentMethodId }) => {
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: stripeCustomerId,
  });

  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  console.log("Payment method attached and set as default");
};

const createCoupon = async ({ id, name, amountOff, percentageOff }) => {
  const query = {
    id,
    name,
    duration: "forever",
  };

  if (amountOff) {
    query.amount_off = amountOff;
  } else {
    query.percent_off = percentageOff;
  }

  await stripe.coupons.create(query);

  console.log("Coupon created successfully");
};

const upgradeOrDowngradeSubscription = async ({ customerId, items }) => {
  const activeSubscription = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const subscriptionId = activeSubscription.data[0].id;

  await stripe.subscriptions.update(subscriptionId, {
    items,
  });
};

module.exports = {
  createStripeCustomer,
  createPaymentIntent,
  getSubscriptions,
  getActiveSubscriptionsOfACustomer,
  getPlans,
  createSubscription,
  attachPaymentMethod,
  createCoupon,
  upgradeOrDowngradeSubscription,
};
