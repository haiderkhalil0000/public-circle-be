const createHttpError = require("http-errors");
const _ = require("lodash");
const moment = require("moment");

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
    (reward.trialInDays || reward.discountInDays || 1) * 24 * 60 * 60;

  await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: Math.floor(Date.now() / 1000), // Start immediately
    end_behavior: "release", // Continue the subscription after the schedule ends
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

  // Retrieve the first invoice created for this customer
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 1,
  });

  if (invoices.data.length > 0) {
    const latestInvoice = invoices.data[0];
    if (latestInvoice.status === "draft") {
      // Finalize the invoice
      await stripe.invoices.finalizeInvoice(latestInvoice.id);

      // Attempt immediate payment (optional, for fail-safe)
      try {
        await stripe.invoices.pay(latestInvoice.id);
      } catch (err) {
        if (err.message.includes("Invoice is already paid")) {
          //ignore
        } else {
          throw createHttpError(400, { errorMessage: err.message });
        }
      }
    }
  }
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

const upgradeOrDowngradeSubscription = async ({
  currentUser,
  customerId,
  items,
}) => {
  const activeSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const subscription = activeSubscriptions.data[0];

  const currentItems = subscription.items.data.map((item) => ({
    id: item.id,
    deleted: true,
  }));

  const updatedItems = items.map((item) => ({
    price: item.price,
  }));

  const combinedItems = [...currentItems, ...updatedItems];

  if (subscription.schedule) {
    await stripe.subscriptionSchedules.release(subscription.schedule);
  }

  const updatedSubscription = await stripe.subscriptions.update(
    subscription.id,
    {
      items: combinedItems,
      coupon: null,
      proration_behavior: "always_invoice",
    }
  );

  if (updatedSubscription.discount) {
    await stripe.subscriptions.deleteDiscount(subscription.id);
  }
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

const readCustomerPaidInvoices = async ({ customerId, pageSize = 10 }) => {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: pageSize,
  });

  return invoices.data.map((item) => ({
    createdAt: moment.unix(item.created).format("YYYY-MM-DD h:mm:ss A"),
    description: item.lines.data
      .reduce((description, item) => {
        return `${description}${item.description}\n`;
      }, "")
      .trimStart(),
    totalCost: Math.abs(item.total) / 100,
    paidWithCustomerBalance:
      Math.abs(item.starting_balance - item.ending_balance) / 100,
    paidWithCard: Math.abs(item.amount_due),
    status: item.status,
    currency: item.currency,
    hostedInvoiceUrl: item.hosted_invoice_url,
    invoicePdf: item.invoice_pdf,
  }));
};

const readCustomerUpcomingInvoices = async ({ customerId }) => {
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
  });

  return {
    createdAt: moment
      .unix(upcomingInvoice.created)
      .format("YYYY-MM-DD h:mm:ss A"),
    description: upcomingInvoice.lines.data
      .reduce((description, item) => {
        return `${description}${item.description}\n`;
      }, "")
      .trimStart(),
    status: upcomingInvoice.status,
    totalCost: upcomingInvoice.total / 100,
    customerBalanceWillApply:
      Math.abs(
        upcomingInvoice.starting_balance - upcomingInvoice.ending_balance
      ) / 100,
    costDue: upcomingInvoice.amount_due,
    currency: upcomingInvoice.currency,
  };
};

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

const readCustomerBalanceHistory = async ({ customerId }) => {
  const transactions = await stripe.customers.listBalanceTransactions(
    customerId
  );

  return transactions.data.map((transaction) => ({
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    created: transaction.created * 1000, // Send as timestamp
    type: transaction.type,
  }));
};

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
  readCustomerPaidInvoices,
  readCustomerUpcomingInvoices,
  readCustomerReceipts,
  readDefaultPaymentMethod,
  readCustomerBalanceHistory,
};
