const createHttpError = require("http-errors");
const _ = require("lodash");

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

const readSetupIntent = async ({ customerId }) =>
  stripe.setupIntents.create({
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

const createSubscription = async ({ currentUserId, customerId, items }) => {
  const currentUserDoc = await User.findById(currentUserId, {
    referralCodeConsumed: 1,
  }).populate("referralCodeConsumed");

  if (!currentUserDoc.referralCodeConsumed) {
    return await stripe.subscriptions.create({
      customer: customerId,
      items,
      // trial_period_days: trialDays, // Optional: Set the trial period (in days)
      // expand: ["latest_invoice.payment_intent"], // Expand the invoice and payment intent for further processing
    });
  }

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

  const phaseStartDate = Math.floor(Date.now() / 1000);

  console.log("phaseStartDate: ", phaseStartDate);
  console.log("trialInDays: ", reward.trialInDays);
  console.log("discountInDays: ", reward.discountInDays);
  console.log("math: ", Math.floor(Date.now() / 1000) + 1);

  const phaseEndDate =
    phaseStartDate +
    (reward.trialInDays ||
      reward.discountInDays ||
      Math.floor(Date.now() / 1000) + 1) *
      24 *
      60 *
      60;

  console.log("phaseEndDate: ", phaseEndDate);

  await stripe.subscriptionSchedules.create({
    customer: customerId,
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
};

const attachPaymentMethod = async ({ customerId, paymentMethodId }) => {
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });
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
};

const upgradeOrDowngradeSubscription = async ({ customerId, items }) => {
  // Retrieve active subscriptions
  const activeSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const subscription = activeSubscriptions.data[0];

  // Map current subscription items to match Stripe's update format
  const currentItems = subscription.items.data.map((item) => ({
    id: item.id,
    deleted: true,
  }));

  // Merge new items into the existing ones
  const updatedItems = items.map((item) => ({
    price: item.price,
    quantity: item.quantity || 1,
  }));

  const combinedItems = [...currentItems, ...updatedItems];

  await stripe.subscriptions.update(subscription.id, {
    items: combinedItems,
    proration_behavior: "always_invoice",
  });
};

const chargeCustomerThroughPaymentIntent = ({
  customerId,
  amountInSmallestUnit,
  currency,
  paymentMethodId,
  description,
}) =>
  stripe.paymentIntents.create({
    customer: customerId,
    amount: amountInSmallestUnit,
    currency,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    description,
  });

const addCustomerBalance = ({ customerId, amountInSmallestUnit, currency }) =>
  stripe.customers.createBalanceTransaction(customerId, {
    amount: -amountInSmallestUnit,
    currency,
  });

const createATopUpInCustomerBalance = async ({
  customerId,
  amountInSmallestUnit,
}) => {
  const customer = await stripe.customers.retrieve(customerId);

  const defaultPaymentMethodId =
    customer.invoice_settings.default_payment_method;

  const paymentIntent = await chargeCustomerThroughPaymentIntent({
    customerId,
    amountInSmallestUnit,
    currency: "cad",
    paymentMethodId: defaultPaymentMethodId,
    description: "Top up",
  });

  if (paymentIntent.status === "succeeded") {
    await addCustomerBalance({
      customerId,
      amountInSmallestUnit,
      currency: "cad",
    });
  }
};

const readCustomerBalance = async ({ customerId }) => {
  const customer = await stripe.customers.retrieve(customerId);

  return `${-customer.balance / 100}$`;
};

const generateImmediateChargeInvoice = async ({
  customerId,
  amountInCents,
}) => {
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    auto_advance: false,
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: amountInCents,
    currency: "cad",
    description: "Extra quota charges",
  });

  await stripe.invoices.finalizeInvoice(invoice.id);
};

const readCustomerInvoices = ({ customerId, pageSize = 10 }) =>
  stripe.invoices.list({
    customer: customerId,
    limit: pageSize,
  });

const readCustomerUpcomingInvoices = ({ customerId }) =>
  stripe.invoices.retrieveUpcoming({
    customer: customerId,
  });

const readCustomerReceipts = async ({ customerId }) => {
  const charges = await stripe.charges.list({
    customer: customerId,
    limit: 100,
  });

  const receipts = charges.data;

  return receipts;
};

const readDefaultPaymentMethod = async ({ customerId }) => {
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPaymentMethodId =
    customer.invoice_settings.default_payment_method;

  if (defaultPaymentMethodId) {
    return await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
  } else {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DEFAULT_PAYMENT_METHOD_MISSING,
    });
  }
};

const readStripeCustomer = ({ customerId }) =>
  stripe.customers.retrieve(customerId);

module.exports = {
  createStripeCustomer,
  readStripeCustomer,
  readSetupIntent,
  getSubscriptions,
  getActiveSubscriptionsOfACustomer,
  getPlans,
  createSubscription,
  attachPaymentMethod,
  createCoupon,
  upgradeOrDowngradeSubscription,
  createATopUpInCustomerBalance,
  readCustomerBalance,
  generateImmediateChargeInvoice,
  readCustomerInvoices,
  readCustomerUpcomingInvoices,
  readCustomerReceipts,
  readDefaultPaymentMethod,
};
