const createHttpError = require("http-errors");
const _ = require("lodash");
const moment = require("moment");

const {
  ReferralCode,
  User,
  Reward,
  Plan,
  OverageConsumption,
  Company,
  EmailSent,
} = require("../models");
const {
  constants: { RESPONSE_MESSAGES, OVERAGE_CONSUMPTION_DOCUMENT_KIND },
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

  // Exclude the product with the name "Top Up"
  const filteredPlans = plans.data.filter((item) => item.name !== "Top Up");

  filteredPlans.forEach((item) => {
    promises.push(stripe.prices.retrieve(item.default_price));
  });

  const prices = await Promise.all(promises);

  filteredPlans.forEach((item, index) => {
    item.price = prices[index];
  });

  return filteredPlans;
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

const upgradeOrDowngradeSubscription = async ({ customerId, items }) => {
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

  const customer = await stripe.customers.retrieve(customerId);
  let balance = customer.balance;

  if (balance < 0) {
    let invoices = await stripe.invoices.list({
      subscription: subscription.id,
      status: "paid",
    });

    invoices = invoices.data.filter((invoice) => invoice.charge);

    const multipleRefunds = [];

    for (const invoice of invoices) {
      if (Math.abs(balance) <= 0) break; // Stop if balance is settled

      const charge = await stripe.charges.retrieve(invoice.charge);

      // Calculate refundable amount
      const refundableAmount = charge.amount - charge.amount_refunded;

      if (refundableAmount > 0) {
        const refundAmount = Math.min(refundableAmount, Math.abs(balance));

        multipleRefunds.push(
          stripe.refunds.create({
            charge: invoice.charge,
            amount: refundAmount,
          })
        );

        balance += refundAmount; // Deduct refunded amount from balance
      }
    }

    // Await all refunds
    await Promise.all(multipleRefunds);

    await stripe.customers.update(customerId, {
      balance: 0,
    });
  }
};

const createATopUpInCustomerBalance = async ({
  customerId,
  amountInSmallestUnit,
}) => {
  const price = await stripe.prices.create({
    product: "prod_RXLIDbemHmqlfQ",
    unit_amount: amountInSmallestUnit,
    currency: "cad",
  });

  const draftInvoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: false,
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    price: price.id,
    invoice: draftInvoice.id,
    description: "Top up",
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(
    draftInvoice.id
  );

  if (finalizedInvoice.status !== "paid") {
    await stripe.invoices.pay(finalizedInvoice.id);
  }
};

const readCustomerBalance = async ({ customerId, companyId }) => {
  const [invoices, company, plans] = await Promise.all([
    stripe.invoices.list({
      customer: customerId,
    }),
    Company.findById(companyId),
    readPlanIds({ customerId }),
  ]);

  let total = 0;

  for (const invoice of invoices.data) {
    const lineItems = await stripe.invoices.listLineItems(invoice.id);

    for (const item of lineItems.data) {
      if (item.price.product === "prod_RXLIDbemHmqlfQ" && item.price) {
        total = total + item.price.unit_amount;
      }
    }
  }

  const emailsSentController = require("./emails-sent.controller");

  const [totalEmailsSentByCompany, totalEmailContentConsumedByCompany, plan] =
    await Promise.all([
      emailsSentController.readEmailSentCount({ companyId }),
      emailsSentController.readEmailContentConsumed({ companyId }),
      Plan.findById(plans[0].planId),
    ]);

  const companyEmailQuota = plan.quota.email;
  const companyEmailContentQuota = plan.quota.emailContent;

  if (
    totalEmailsSentByCompany <= companyEmailQuota &&
    totalEmailContentConsumedByCompany <= companyEmailContentQuota
  ) {
    return total / 100;
  }

  const { emails, priceInSmallestUnit: emailsPriceInSmallestUnit } =
    plan.bundles.email;
  const { bandwidth, priceInSmallestUnit: emailContentPriceInSmallestUnit } =
    plan.bundles.emailContent;

  const emailCharge =
    (company.extraQuota.email / emails) * emailsPriceInSmallestUnit;
  const emailContentCharge =
    (company.extraQuota.emailContent / bandwidth) *
    emailContentPriceInSmallestUnit;

  return (total - emailCharge - emailContentCharge) / 100;
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

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

  if (finalizedInvoice.status !== "paid") {
    await stripe.invoices.pay(finalizedInvoice.id);
  }
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
    paidWithCard: Math.abs(item.amount_due) / 100,
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
    costDue: upcomingInvoice.amount_due / 100,
    currency: upcomingInvoice.currency,
  };
};

const getReceiptDescription = ({ description }) => {
  if (description.includes("Subscription creation")) {
    return "Subscription purchased.";
  }

  return description;
};

const readCustomerReceipts = async ({ customerId }) => {
  const charges = await stripe.charges.list({
    customer: customerId,
    limit: 100,
  });

  const receipts = charges.data;

  return receipts.map((item) => ({
    createdAt: moment.unix(item.created).format("YYYY-MM-DD h:mm:ss A"),
    description: getReceiptDescription({ description: item.description }),
    amount: item.amount / 100,
    currency: item.currency,
    receiptUrl: item.receipt_url,
    status: item.status,
  }));
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

const readCustomerBalanceHistory = async ({ customerId }) =>
  OverageConsumption.find({
    customerId,
    kind: OVERAGE_CONSUMPTION_DOCUMENT_KIND.PUBLIC,
  });

const createPendingInvoiceItem = async ({
  customerId,
  chargeAmountInSmallestUnit,
}) =>
  stripe.invoiceItems.create({
    customer: customerId,
    amount: chargeAmountInSmallestUnit,
    currency: "cad",
    description: "Contacts import overage charges.",
  });

const chargeCustomerFromBalance = ({
  customerId,
  amountInSmallestUnit,
  updatedBalance,
}) => {
  if (amountInSmallestUnit < 0) {
    amountInSmallestUnit = 0;
  }

  return stripe.customers.update(customerId, {
    balance: updatedBalance,
  });
};

const readPlanIds = async ({ customerId }) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  const productIds = [
    ...new Set(
      subscriptions.data.flatMap((subscription) =>
        subscription.items.data.map((item) => item.price.product)
      )
    ),
  ];

  return Promise.all(
    productIds.map((productId) =>
      stripe.products.retrieve(productId).then((product) => ({
        planId: product.metadata.planId,
      }))
    )
  );
};

const readPendingInvoiceItems = ({ customerId }) =>
  stripe.invoiceItems.list({
    customer: customerId,
    pending: true,
  });

const readPaidInvoices = ({ customerId }) =>
  stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 20,
  });

const deleteInvoiceItem = async ({ invoiceItemId }) => {
  await stripe.invoiceItems.del(invoiceItemId);
};

const readUpcomingBillingDate = async ({ customerId }) => {
  let activeSubscription = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
  });

  activeSubscription = activeSubscription.data[0];

  return moment.unix(activeSubscription.current_period_end);
};

const readInvoiceById = ({ invoiceId }) => stripe.invoices.retrieve(invoiceId);

const readInvoiceLineItems = ({ invoiceId }) =>
  stripe.invoices.listLineItems(invoiceId);

const readStripeEvent = async ({ stripeSignature, body }) => {
  const endpointSecret = "whsec_If7HK7wlpvmX6ig8eCdNf0ujOauA64GA";

  const event = await stripe.webhooks.constructEvent(
    body,
    stripeSignature,
    endpointSecret
  );

  const invoiceId = event.data.object.id;

  const invoiceItems = await stripe.invoiceItems.list({
    invoice: invoiceId,
  });

  const invoiceItemIds = [];
  let customerId = "";

  invoiceItems.data.forEach((invoiceItem) => {
    if (invoiceItem.description === "Contacts import overage charges.") {
      customerId = invoiceItem.customer;
      invoiceItemIds.push(invoiceItem.id);
    }
  });

  const overageConsumptionController = require("./overage-consumption.controller");

  const [latestPrivateOverageConsumptionEntry, planIds] = await Promise.all([
    overageConsumptionController.readLatestPrivateOverageConsumption({
      customerId,
    }),
    readPlanIds({ customerId }),
  ]);

  console.log("invoiceItemItds", invoiceItemIds);
  console.log(
    "latestPrivateOverageConsumptionEntry",
    latestPrivateOverageConsumptionEntry
  );
  console.log(
    "stripeInvoiceItemId",
    latestPrivateOverageConsumptionEntry.stripeInvoiceItemId
  );

  if (
    invoiceItemIds.includes(
      latestPrivateOverageConsumptionEntry.stripeInvoiceItemId
    )
  ) {
    console.log("invoiceItemId matched!");

    const companyContactsController = require("./company-users.controller");

    const [companyContactsCount, plan] = await Promise.all([
      companyContactsController.readCompanyContactsCount({
        companyId: latestPrivateOverageConsumptionEntry.company,
      }),
      Plan.findById(planIds[0].planId),
    ]);

    console.log("companyContactsCount", companyContactsCount);

    const contactsAboveQuota = Math.abs(
      companyContactsCount - plan.quota.contacts
    );

    console.log("contactsAboveQuota", contactsAboveQuota);

    const { contacts, priceInSmallestUnit } = plan.bundles.contact;

    const extraContactsQuotaCharge =
      Math.ceil(contactsAboveQuota / contacts) * priceInSmallestUnit;

    console.log("extraContactsQuotaCharge", extraContactsQuotaCharge);

    const pendingInvoiceItem = await createPendingInvoiceItem({
      customerId,
      chargeAmountInSmallestUnit: extraContactsQuotaCharge,
    });

    overageConsumptionController.createOverageConsumption({
      companyId: latestPrivateOverageConsumptionEntry.company,
      customerId,
      description: "Overage charge for importing contacts above quota.",
      contactOverage: `${contactsAboveQuota} contacts`,
      contactOverageCharge: extraContactsQuotaCharge,
      stripeInvoiceItemId: pendingInvoiceItem.id,
    });
  }
};

const readCustomerStripeBalance = async ({ customerId }) => {
  // await stripe.customers.update(customerId, {
  //   balance: 0,
  // });

  const customer = await readStripeCustomer({ customerId });

  return customer.balance;
};

const readQuotaDetails = async ({ companyId, customerId }) => {
  const [planIds, company, emailsSentDocs] = await Promise.all([
    readPlanIds({
      customerId,
    }),
    Company.findById(companyId),
    EmailSent.find({ company: companyId }, { size: 1 }),
  ]);

  const totalEmailContentSent = emailsSentDocs
    .map((item) => item.size)
    .reduce((total, current) => total + current, 0);

  const plan = await Plan.findById(planIds[0].planId);

  const communicationQuotaAllowed = plan.quota.email + company.extraQuota.email;

  const communicationQuotaConsumed = emailsSentDocs.length;

  const bandwidthQuotaAllowed =
    (plan.quota.emailContent + company.extraQuota.emailContent) / 1000;

  const bandwidthQuotaConsumed = totalEmailContentSent / 1000;

  return {
    communicationQuotaAllowed,
    communicationQuotaConsumed,
    bandwidthQuotaAllowed,
    bandwidthQuotaConsumed,
  };
};

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
  readCustomerPaidInvoices,
  readCustomerUpcomingInvoices,
  readCustomerReceipts,
  readDefaultPaymentMethod,
  readCustomerBalanceHistory,
  createPendingInvoiceItem,
  chargeCustomerFromBalance,
  readPlanIds,
  readPendingInvoiceItems,
  deleteInvoiceItem,
  readUpcomingBillingDate,
  readInvoiceById,
  readPaidInvoices,
  readInvoiceLineItems,
  readStripeEvent,
  readCustomerStripeBalance,
  readQuotaDetails,
};
