const createHttpError = require("http-errors");
const _ = require("lodash");

const { ReferralCode, User, Reward } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const { STRIPE_KEY } = process.env;

const stripe = require("stripe")(STRIPE_KEY);

const createStripeCustomer = async ({ companyId, companyName, emailAddress }) =>
  stripe.customers.create({
    name: companyName,
    email: emailAddress,
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
  const phaseEndDate =
    phaseStartDate +
    (reward.trialInDays ||
      reward.discountInDays ||
      Math.floor(Date.now() / 1000)) *
      24 *
      60 *
      60;

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

// const upgradeOrDowngradeSubscription = async ({ customerId, items }) => {
//   const activeSubscription = await stripe.subscriptions.list({
//     customer: customerId,
//     status: "active",
//   });

//   const subscriptionId = activeSubscription.data[0].id;
//   const activeSubscriptionItems = activeSubscription.data[0].items.data.map(
//     (item) => ({
//       id: item.id,
//       price: item.price.id,
//     })
//   );

//   activeSubscriptionItems.forEach((item) => {
//     item.deleted = true;
//   });

//   items = [...new Set([...activeSubscriptionItems, ...items])];

//   await stripe.subscriptions.update(subscriptionId, {
//     items,
//     proration_behavior: "create_prorations",
//   });
// };

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

  // Add a line item to the invoice
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountInSmallestUnit,
    currency: "cad",
    description: "Top up",
  });

  // Create and finalize the invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    description: "Top up",
    collection_method: "send_invoice", // Ensure no automatic charge
    auto_advance: false, // Do not finalize automatically
    days_until_due: 1,
  });

  // Finalize the invoice
  await stripe.invoices.finalizeInvoice(invoice.id);

  // Mark the invoice as paid manually
  await stripe.invoices.pay(invoice.id, {
    paid_out_of_band: true, // Indicates the payment was made outside of Stripe
  });
};

const readCustomerBalance = async ({ customerId }) => {
  const customer = await stripe.customers.retrieve(customerId);

  return `${-customer.balance / 100}$`;
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

const readCustomerInvoices = ({ customerId, pageSize = 10 }) =>
  stripe.invoices.list({
    customer: customerId,
    limit: pageSize,
  });

module.exports = {
  createStripeCustomer,
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
};
