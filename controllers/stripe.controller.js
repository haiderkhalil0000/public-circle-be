const createHttpError = require("http-errors");
const _ = require("lodash");
const moment = require("moment");
const momentTz = require("moment-timezone");

const {
  ReferralCode,
  User,
  Reward,
  Plan,
  OverageConsumption,
  EmailSent,
} = require("../models");
const {
  constants: { RESPONSE_MESSAGES, OVERAGE_KIND },
  basicUtil,
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

const readSetupIntent = async ({ stripeCustomerId }) =>
  stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
  });

const getSubscriptions = async ({ pageSize }) => {
  const { data } = await stripe.subscriptions.list({
    limit: pageSize,
  });

  return data;
};

const readActivePlansByCustomerId = async ({ stripeCustomerId }) => {
  let activeSubscription = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
  });

  activeSubscription = activeSubscription.data[0];

  const activePlans = [];

  if (activeSubscription) {
    for (const item of activeSubscription.items.data) {
      const price = item.price;
      const productId = price.product;

      const product = await stripe.products.retrieve(productId);

      const priceAmount = price.unit_amount / 100;
      const priceCurrency = price.currency.toUpperCase();

      activePlans.push({
        productId,
        productName: product.name,
        productPrice: `${priceAmount} ${priceCurrency}`,
      });
    }

    return activePlans;
  } else {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ACTIVE_PLAN_NOT_FOUND,
    });
  }
};

const readActiveBillingCycleDates = async ({ stripeCustomerId }) => {
  let activeSubscription = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 1,
  });

  activeSubscription = activeSubscription.data[0];

  return {
    startDate: moment.unix(activeSubscription.current_period_start).utc(),
    endDate: moment.unix(activeSubscription.current_period_end).utc(),
  };
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
    customer: stripeCustomerId,
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
    customer: stripeCustomerId,
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

const attachPaymentMethod = async ({ stripeCustomerId, paymentMethodId }) => {
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: stripeCustomerId,
  });

  await stripe.customers.update(stripeCustomerId, {
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

const upgradeOrDowngradeSubscription = async ({ stripeCustomerId, items }) => {
  const activeSubscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
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

  const customer = await stripe.customers.retrieve(stripeCustomerId);
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

    await stripe.customers.update(stripeCustomerId, {
      balance: 0,
    });
  }
};

const createATopUpInCustomerBalance = async ({
  companyId,
  stripeCustomerId,
  amount,
}) => {
  amount = amount * 100;

  const price = await stripe.prices.create({
    product: "prod_RXLIDbemHmqlfQ",
    unit_amount: amount,
    currency: "cad",
  });

  const draftInvoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    auto_advance: false,
    description: "Top up",
    metadata: {
      customerId: stripeCustomerId,
      description: "Top up",
    },
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
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

  const topupController = require("./topup.controller");

  await topupController.syncTopups({ companyId, stripeCustomerId });
};

const readCustomerBalance = async ({ companyId }) => {
  const topupController = require("./topup.controller");

  const [topupDocs, overageConsuptionDocs] = await Promise.all([
    topupController.readTopupsByCompanyId({ companyId }),
    OverageConsumption.find({
      company: companyId,
      kind: { $ne: OVERAGE_KIND.CONTACT },
    }),
  ]);

  const totalTopup = topupDocs
    .map((item) => item.price)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const totalOverage = overageConsuptionDocs
    .map((item) => item.overagePrice)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  return totalTopup - totalOverage;
};

const readUpdatedBalance = async ({ companyId, stripeCustomerId }) => {
  const topupController = require("./topup.controller");

  await topupController.syncTopups({ companyId, stripeCustomerId });

  const [topupDocs, overageConsuptionDocs] = await Promise.all([
    topupController.readTopupsByCompanyId({ companyId }),
    OverageConsumption.find({
      company: companyId,
      kind: { $ne: OVERAGE_KIND.CONTACT },
    }),
  ]);

  const totalTopup = topupDocs
    .map((item) => item.price)
    .reduce((totalValue, currentValue) => totalValue + currentValue);

  const totalOverage = overageConsuptionDocs
    .map((item) => item.overagePrice)
    .reduce((totalValue, currentValue) => totalValue + currentValue);

  return totalTopup - totalOverage;
};

const generateImmediateChargeInvoice = async ({
  stripeCustomerId,
  amountInCents,
}) => {
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "charge_automatically",
    auto_advance: false,
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
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

const readCustomerPaidInvoices = async ({
  stripeCustomerId,
  pageSize = 10,
}) => {
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    status: "paid",
    limit: pageSize,
  });

  return invoices.data.map((item) => ({
    createdAt: momentTz
      .unix(item.created)
      .tz("Etc/GMT-5")
      .format("YYYY-MM-DD h:mm:ss A"),
    description: item.lines.data
      .reduce((description, item) => {
        return `${description}${item.description}\n`;
      }, "")
      .trimStart(),
    totalCost: item.total / 100,
    status: item.total > 0 ? item.status : "Refunded",
    currency: item.currency,
    hostedInvoiceUrl: item.hosted_invoice_url,
    invoicePdf: item.invoice_pdf,
  }));
};

const readCustomerUpcomingInvoices = async ({ stripeCustomerId }) => {
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: stripeCustomerId,
  });

  return {
    createdAt: momentTz
      .unix(upcomingInvoice.created)
      .tz("Etc/GMT-5")
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

const getReceiptKind = ({ description }) => {
  if (description.includes("Subscription creation")) {
    return "Subscription purchased.";
  }

  return description;
};

const readCustomerReceipts = async ({ stripeCustomerId }) => {
  const charges = await stripe.charges.list({
    customer: stripeCustomerId,
    limit: 100,
  });

  const receipts = charges.data;

  return receipts.map((item) => ({
    createdAt: momentTz
      .unix(item.created)
      .tz("Etc/GMT-5")
      .format("YYYY-MM-DD h:mm:ss A"),
    description: getReceiptDescription({ description: item.description }),
    // kind: getReceiptKind({ description: item.description }),
    amount: item.amount / 100,
    currency: item.currency,
    receiptUrl: item.receipt_url,
    status: item.status,
  }));
};

const readDefaultPaymentMethod = async ({ stripeCustomerId }) => {
  const customer = await stripe.customers.retrieve(stripeCustomerId);
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

const readStripeCustomer = ({ stripeCustomerId }) =>
  stripe.customers.retrieve(stripeCustomerId);

const readCustomerBalanceHistory = async ({ companyId }) =>
  OverageConsumption.find({
    company: companyId,
    kind: { $ne: OVERAGE_KIND.CONTACT },
  });

const createPendingInvoiceItem = async ({ stripeCustomerId, price }) =>
  stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: price * 100,
    currency: "cad",
    description: "Contacts import overage charges.",
  });

const chargeCustomerFromBalance = ({
  stripeCustomerId,
  amountInSmallestUnit,
  updatedBalance,
}) => {
  if (amountInSmallestUnit < 0) {
    amountInSmallestUnit = 0;
  }

  return stripe.customers.update(stripeCustomerId, {
    balance: updatedBalance,
  });
};

const readPlanIds = async ({ stripeCustomerId }) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
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

const readPendingInvoiceItems = ({ stripeCustomerId }) =>
  stripe.invoiceItems.list({
    customer: stripeCustomerId,
    pending: true,
  });

const readPaidInvoices = ({ stripeCustomerId }) =>
  stripe.invoices.list({
    customer: stripeCustomerId,
    status: "paid",
    limit: 20,
  });

const deleteInvoiceItem = async ({ invoiceItemId }) => {
  await stripe.invoiceItems.del(invoiceItemId);
};

const readUpcomingBillingDate = async ({ stripeCustomerId }) => {
  let activeSubscription = await stripe.subscriptions.list({
    customer: stripeCustomerId,
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
  let stripeCustomerId = "";

  invoiceItems.data.forEach((invoiceItem) => {
    if (invoiceItem.description === "Contacts import overage charges.") {
      stripeCustomerId = invoiceItem.customer;
      invoiceItemIds.push(invoiceItem.id);
    }
  });

  if (!stripeCustomerId) {
    return;
  }

  const overageConsumptionController = require("./overage-consumption.controller");

  const [latestPrivateOverageConsumptionEntry, planIds] = await Promise.all([
    overageConsumptionController.readLatestPrivateOverageConsumption({
      stripeCustomerId,
    }),
    readPlanIds({ stripeCustomerId }),
  ]);

  if (!latestPrivateOverageConsumptionEntry) {
    return;
  }

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

    const { contacts, price } = plan.bundles.contact;

    const extraContactsQuotaCharge =
      Math.ceil(contactsAboveQuota / contacts) * price;

    console.log("extraContactsQuotaCharge", extraContactsQuotaCharge);

    const pendingInvoiceItem = await createPendingInvoiceItem({
      stripeCustomerId,
      chargeAmountInSmallestUnit: extraContactsQuotaCharge,
    });

    overageConsumptionController.createOverageConsumption({
      companyId: latestPrivateOverageConsumptionEntry.company,
      stripeCustomerId,
      description: "Overage charge for importing contacts above quota.",
      contactOverage: `${contactsAboveQuota} contacts`,
      contactOverageCharge: extraContactsQuotaCharge,
      stripeInvoiceItemId: pendingInvoiceItem.id,
    });
  }
};

const readCustomerStripeBalance = async ({ stripeCustomerId }) => {
  // await stripe.customers.update(stripeCustomerId, {
  //   balance: 0,
  // });

  const customer = await readStripeCustomer({ stripeCustomerId });

  return customer.balance;
};

const readQuotaDetails = async ({ companyId, stripeCustomerId }) => {
  const overageConsumptionController = require("./overage-consumption.controller");

  const [planIds, emailOverageDocs, emailContentOverageDocs, emailsSentDocs] =
    await Promise.all([
      readPlanIds({
        stripeCustomerId,
      }),
      overageConsumptionController.readEmailOverage({ companyId }),
      overageConsumptionController.readEmailContentOverage({ companyId }),
      EmailSent.find({ company: companyId }, { size: 1 }),
    ]);

  const companyExtraEmailQuota = emailOverageDocs
    .map((item) => item.overageCount)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const companyExtraEmailContentQuota = emailContentOverageDocs
    .map((item) => item.overageCount)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const totalEmailContentSent = emailsSentDocs
    .map((item) => item.size)
    .reduce((total, current) => total + current, 0);

  const plan = await Plan.findById(planIds[0].planId);

  const communicationQuotaAllowed = companyExtraEmailQuota;

  const communicationQuotaConsumed =
    communicationQuotaAllowed - emailsSentDocs.length;

  const bandwidthQuotaAllowed = companyExtraEmailContentQuota * 1000;

  const bandwidthQuotaConsumed = Math.abs(
    bandwidthQuotaAllowed - totalEmailContentSent
  );

  return {
    communicationQuotaAllowed,
    communicationQuotaConsumed,
    communicationQuotaAllowedUnit:
      communicationQuotaAllowed === 1 ? "email" : "emails",
    communicationQuotaConsumedUnit:
      communicationQuotaConsumed === 1 ? "email" : "emails",
    bandwidthQuotaAllowed: parseFloat(bandwidthQuotaAllowed.toFixed(2)),
    bandwidthQuotaConsumed: parseFloat(bandwidthQuotaConsumed.toFixed(2)),
    bandwidthQuotaAllowedUnit: basicUtil.calculateByteUnit({
      bytes: bandwidthQuotaAllowed,
    }),
    bandwidthQuotaConsumedUnit: basicUtil.calculateByteUnit({
      bytes: bandwidthQuotaConsumed,
    }),
  };
};

const readTopupInvoices = async ({ stripeCustomerId }) => {
  let invoices = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    const params = {
      customer: stripeCustomerId,
      limit: 100, // Adjust as needed
    };

    if (startingAfter) {
      params.starting_after = startingAfter; // Use Stripe's pagination method
    }

    try {
      const response = await stripe.invoices.list(params);

      // Manually filter invoices based on metadata description
      const topupInvoices = response.data.filter(
        (invoice) =>
          invoice.metadata && invoice.metadata.description === "Top up"
      );

      // Collect the current batch of invoices
      invoices = invoices.concat(topupInvoices);

      // Update pagination variables
      hasMore = response.has_more;

      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      break; // Stop further requests in case of an error
    }
  }

  return invoices;
};

module.exports = {
  createStripeCustomer,
  readSetupIntent,
  getSubscriptions,
  readActivePlansByCustomerId,
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
  readActiveBillingCycleDates,
  readTopupInvoices,
  readUpdatedBalance,
};
