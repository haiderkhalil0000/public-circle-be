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

const createPaymentIntent = async ({ customerId, items }) => {
  // const allPrices = await Promise.all(
  //   items.map((item) => stripe.prices.retrieve(item.priceId))
  // );

  // const totalPrice = allPrices
  //   .map((price) => price.unit_amount || 0)
  //   .reduce((total, amount) => total + amount, 0);

  return await stripe.setupIntents.create({
    customer: customerId, // Replace with the Stripe customer ID
    payment_method_types: ["card"], // Add other types if needed
  });

  // return stripe.paymentIntents.create({
  //   amount: totalPrice,
  //   currency: "usd",
  //   customer: customerId,
  //   payment_method_types: ["card"],
  //   setup_future_usage: "off_session",
  // });
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

  console.log("reward : ", reward);

  const phaseStartDate = Math.floor(Date.now() / 1000);
  const phaseEndDate =
    phaseStartDate +
    (reward.trialInDays || reward.discountInDays) * 24 * 60 * 60;

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

const calculateProratedAmount = async ({
  customerId,
  subscriptionId,
  items,
}) => {
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
    subscription: subscriptionId,
    subscription_items: items,
  });

  // Extract line items, defaulting to an empty array if undefined
  const lineItems = upcomingInvoice.lines?.data || [];

  // Initialize variables for prorated amounts
  let proratedCredit = 0;
  let proratedCharge = 0;

  // Iterate over the line items to calculate charges and credits
  for (const lineItem of lineItems) {
    if (lineItem.amount < 0) {
      proratedCredit += Math.abs(lineItem.amount); // Sum up all negative amounts (credits)
    } else {
      proratedCharge += lineItem.amount; // Sum up all positive amounts (charges)
    }
  }

  // Return both prorated credit and charge amounts
  return {
    proratedCredit,
    proratedCharge,
  };
};

const chargeForUpgrade = async ({ customerId, subscriptionId }) => {
  // Step 1: Create an invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    subscription: subscriptionId,
    auto_advance: true, // Automatically finalize the invoice
  });

  // Step 2: Finalize the invoice (if not auto-finalized)
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

  return finalizedInvoice;
};

const getLatestInvoiceForSubscription = async ({ subscriptionId }) => {
  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    limit: 1, // Get the most recent invoice
  });

  if (invoices.data.length > 0) {
    const latestInvoice = invoices.data[0];

    return {
      invoiceId: latestInvoice.id,
      invoiceAmount: invoices.data[0].lines.data[0].amount,
    };
  } else {
    console.log("No invoices found for subscription.");
    return null;
  }
};

const upgradeOrDowngradeSubscription = async ({ customerId, items }) => {
  const activeSubscription = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const subscriptionId = activeSubscription.data[0].id;
  const activeSubscriptionItems = activeSubscription.data[0].items.data.map(
    (item) => ({
      id: item.id,
      price: item.price.id,
    })
  );

  activeSubscriptionItems.forEach((item) => {
    item.deleted = true;
  });

  items = [...new Set([...activeSubscriptionItems, ...items])];

  // const { proratedCredit, proratedCharge } = await calculateProratedAmount({
  //   customerId,
  //   subscriptionId,
  //   items,
  // });

  await stripe.subscriptions.update(subscriptionId, {
    items,
    proration_behavior: "create_prorations",
  });

  // const { invoiceId, invoiceAmount } = await getLatestInvoiceForSubscription({
  //   subscriptionId,
  // });

  // if (proratedCredit) {
  //   await stripe.creditNotes.create({
  //     invoice: invoiceId, // Invoice that charged the original subscription fee
  //     amount: proratedCredit, // The prorated credit amount
  //     reason: "order_change",
  //     out_of_band_amount: Math.max(0, invoiceAmount - proratedCredit),
  //   });
  // }
  // if (proratedCharge) {
  //   await chargeForUpgrade({ customerId, subscriptionId });
  // }
};

const createATopUpInCustomerBalance = async ({ customerId, amount }) => {
  const customer = await stripe.customers.retrieve(customerId);

  const defaultPaymentMethodId =
    customer.invoice_settings.default_payment_method;

  await stripe.paymentIntents.create({
    amount: parseInt(amount), // Amount in cents, e.g., 1000 for $10
    currency: "CAD",
    customer: customerId, // The Stripe customer to charge
    payment_method: defaultPaymentMethodId,
    payment_method_types: ["card"], // Assuming the default payment method is a card
    confirm: true, // Automatically confirm the PaymentIntent
  });

  await stripe.customers.createBalanceTransaction(customerId, {
    amount: amount, // Positive value adds to the balance
    currency: "CAD",
    description: "Top-Up",
  });
};

const readCustomerBalance = async ({ customerId }) => {
  const customer = await stripe.customers.retrieve(customerId);

  return `${customer.balance / 100}$`;
};

const generateImmediateChargeInvoice = async ({
  customerId,
  amountInCents,
}) => {
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountInCents, // Amount in cents (e.g., $1 = 100)
    currency: "CAD",
    description: "Extra email quota charges",
  });

  // Step 2: Create the invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true, // Automatically finalize and attempt payment
    collection_method: "charge_automatically",
  });

  // Step 3: Finalize and charge the invoice
  await stripe.invoices.finalizeInvoice(invoice.id);
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
  createATopUpInCustomerBalance,
  readCustomerBalance,
  generateImmediateChargeInvoice,
};
