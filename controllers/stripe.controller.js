const createHttpError = require("http-errors");
const _ = require("lodash");
const moment = require("moment");
const momentTz = require("moment-timezone");

const { ReferralCode, User, Reward, Plan } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
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
    startDate: moment
      .unix(activeSubscription.current_period_start)
      .utc()
      .startOf("day")
      .format(),
    endDate: moment
      .unix(activeSubscription.current_period_end)
      .utc()
      .endOf("day")
      .format(),
  };
};

const readPlans = async ({ pageSize, stripeCustomerId }) => {
  const plansController = require("./plans.controller");

  const promises = [];

  const [stripePlans, dbPlans] = await Promise.all([
    stripe.products.list({
      limit: pageSize,
    }),
    plansController.readAllPlans(),
  ]);

  let activePlanArray;

  // Exclude the product with the name "Top Up"
  const filteredPlans = stripePlans.data.filter(
    (item) => item.name !== "Top Up"
  );

  try {
    const activePlanArrayTemp = await readActivePlansByCustomerId({
      stripeCustomerId,
    });

    activePlanArray = activePlanArrayTemp;
  } catch (err) {
    const promises = [];

    if (err.errorMessage.includes("No active plan found!")) {
      filteredPlans.forEach((item) => {
        promises.push(stripe.prices.retrieve(item.default_price));
      });

      const prices = await Promise.all(promises);

      filteredPlans.forEach((item, index) => {
        item.price = prices[index];

        const dbPlan = dbPlans.find((plan) => plan.name === item.name);

        if (dbPlan) {
          item.description = [
            `${dbPlan.quota.email} emails`,
            `${basicUtil.calculateByteUnit({
              bytes: dbPlan.quota.bandwidth,
            })} of bandwidth`,
            `${dbPlan.quota.contact} contacts`,
          ];
        }
      });

      return filteredPlans;
    }
  }

  const activePlan = activePlanArray[0];
  const activePlanPrice = Number(activePlan.productPrice.split(" ")[0]);

  filteredPlans.forEach((item) => {
    promises.push(stripe.prices.retrieve(item.default_price));
  });

  const prices = await Promise.all(promises);

  const today = moment();
  const currentDayOfMonth = today.date();

  const daysInMonth = moment().daysInMonth();

  filteredPlans.forEach((item, index) => {
    if (item.id === activePlan.productId) {
      item.isActivePlan = true;
    }

    item.price = prices[index];
    item.price.unit_amount = item.price.unit_amount / 100;

    if (item.isActivePlan) {
      item.price.proratedAmount = 0;
    } else {
      item.price.proratedAmount =
        ((item.price.unit_amount / 100 - activePlanPrice) / daysInMonth) *
        (daysInMonth - currentDayOfMonth + 1);
    }

    const dbPlan = dbPlans.find((plan) => plan.name === item.name);

    if (dbPlan) {
      item.description = [
        `${dbPlan.quota.email} emails`,
        `${basicUtil.calculateByteUnit({
          bytes: dbPlan.quota.bandwidth,
        })} of bandwidth`,
        `${dbPlan.quota.contact} contacts`,
      ];
    }
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
  const price = await stripe.prices.create({
    product: "prod_RXLIDbemHmqlfQ",
    unit_amount: amount * 100, //passing amount in cents
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

  await topupController.syncTopups({
    companyId,
    stripeCustomerId,
  });
};

const readCustomerBalance = async ({ companyId, stripeCustomerId }) => {
  const topupController = require("./topup.controller");
  const emailsSentController = require("./emails-sent.controller");

  const activeBillingCycleDates = await readActiveBillingCycleDates({
    stripeCustomerId,
  });

  const [topupDocs, emailsSentDocs, planIds] = await Promise.all([
    topupController.readTopupsByCompanyId({ companyId }),
    emailsSentController.readEmailsSentByCompanyId({
      companyId,
      startDate: activeBillingCycleDates.startDate,
      endDate: activeBillingCycleDates.endDate,
      project: { size: 1 },
    }),
    readPlanIds({
      stripeCustomerId,
    }),
  ]);

  const plan = await Plan.findById(planIds[0].planId);

  const totalTopup = topupDocs
    .map((item) => item.priceInSmallestUnit)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const paidEmails =
    emailsSentDocs.length - plan.quota.email > 0
      ? emailsSentDocs.length - plan.quota.email
      : 0;

  const paidEmailsPrice =
    paidEmails / (plan.bundles.email.priceInSmallestUnit / 100);

  const totalBandwidthSent = emailsSentDocs
    .map((item) => item.size)
    .reduce((totalValue, currentValue) => totalValue + currentValue, 0);

  const paidEmailContent =
    totalBandwidthSent - plan.quota.bandwidth > 0
      ? totalBandwidthSent - plan.quota.bandwidth
      : 0;

  const paidEmailContentPrice =
    paidEmailContent / plan.bundles.bandwidth.priceInSmallestUnit;

  return (totalTopup - paidEmailsPrice * 100 - paidEmailContentPrice) / 100; //converted into cad
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
        return `${description} ${item.description},`.trim();
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
        return `${description} ${item.description},`.trim();
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

const createPendingInvoiceItem = async ({
  stripeCustomerId,
  price,
  description,
}) =>
  stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: price,
    currency: "cad",
    description,
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
    if (invoiceItem.description.includes("contact")) {
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
    const companyContactsController = require("./company-contacts.controller");

    const [companyContactsCount, plan] = await Promise.all([
      companyContactsController.readCompanyContactsCount({
        companyId: latestPrivateOverageConsumptionEntry.company,
      }),
      Plan.findById(planIds[0].planId),
    ]);

    const contactsAboveQuota = Math.abs(
      companyContactsCount - plan.quota.contact
    );

    const { contacts, price } = plan.bundles.contact;

    const extraContactsQuotaCharge =
      Math.ceil(contactsAboveQuota / contacts) * price;

    const pendingInvoiceItem = await createPendingInvoiceItem({
      stripeCustomerId,
      chargeAmountInSmallestUnit: extraContactsQuotaCharge,
      description: `${contactsAboveQuota} x contact (at $${price} / month)`,
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
  const customer = await readStripeCustomer({ stripeCustomerId });

  return customer.balance;
};

const quotaDetails = async ({ companyId, stripeCustomerId }) => {
  const emailsSentController = require("./emails-sent.controller");

  const activeBillingDates = await readActiveBillingCycleDates({
    stripeCustomerId,
  });

  const [planIds, emailsSentDocs] = await Promise.all([
    readPlanIds({
      stripeCustomerId,
    }),
    emailsSentController.readEmailsSentByCompanyId({
      companyId,
      startDate: activeBillingDates.startDate,
      endDate: activeBillingDates.endDate,
      project: { size: 1 },
    }),
  ]);

  const totalEmailContentSent = emailsSentDocs
    .map((item) => item.size)
    .reduce((total, current) => total + current, 0);

  const plan = await Plan.findById(planIds[0].planId);

  const emailsAllowedInPlan = plan.quota.email;

  const emailsConsumedInPlan =
    plan.quota.email - emailsSentDocs.length > 0
      ? emailsSentDocs.length
      : plan.quota.email;

  const emailsConsumedInOverage =
    emailsSentDocs.length - plan.quota.email > 0
      ? emailsSentDocs.length - plan.quota.email
      : 0;

  const emailsConsumedInOveragePrice =
    (emailsConsumedInOverage * plan.bundles.email.priceInSmallestUnit) / 100;

  const bandwidthAllowedInPlan = Number(
    basicUtil
      .calculateByteUnit({
        bytes: plan.quota.bandwidth,
      })
      .split([" "])[0]
  );

  const bandwidthConsumedInPlan = Number(
    basicUtil
      .calculateByteUnit({
        bytes:
          plan.quota.bandwidth - totalEmailContentSent > 0
            ? totalEmailContentSent
            : plan.quota.bandwidth,
      })
      .split([" "])[0]
  );

  const bandwidthConsumedInOverage = Number(
    basicUtil
      .calculateByteUnit({
        bytes:
          totalEmailContentSent - plan.quota.bandwidth > 0
            ? totalEmailContentSent - plan.quota.bandwidth
            : 0,
      })
      .split([" "])[0]
  );

  const bandwidthConsumedInOveragePrice =
    bandwidthConsumedInOverage * plan.bundles.bandwidth.priceInSmallestUnit;

  const emailsAllowedInPlanUnit =
    emailsAllowedInPlan === 1 ? "email" : "emails";

  const emailsConsumedInPlanUnit =
    emailsConsumedInPlan === 1 ? "email" : "emails";

  const emailsConsumedInOverageUnit =
    emailsConsumedInOverage === 1 ? "email" : "emails";

  const emailsConsumedInOveragePriceUnit = "CAD";

  const bandwidthAllowedInPlanUnit = basicUtil
    .calculateByteUnit({
      bytes: plan.quota.bandwidth,
    })
    .split([" "])[1];

  const bandwidthConsumedInPlanUnit = basicUtil
    .calculateByteUnit({
      bytes:
        plan.quota.bandwidth - totalEmailContentSent > 0
          ? totalEmailContentSent
          : plan.quota.bandwidth,
    })
    .split([" "])[1];

  const bandwidthConsumedInOverageUnit = basicUtil
    .calculateByteUnit({
      bytes:
        totalEmailContentSent - plan.quota.bandwidth > 0
          ? totalEmailContentSent - plan.quota.bandwidth
          : 0,
    })
    .split([" "])[1];

  const bandwidthConsumedInOveragePriceUnit = "CAD";

  return {
    emailsAllowedInPlan,
    emailsAllowedInPlanUnit,
    emailsConsumedInPlan,
    emailsConsumedInPlanUnit,
    emailsConsumedInOverage,
    emailsConsumedInOverageUnit,
    emailsConsumedInOveragePrice,
    emailsConsumedInOveragePriceUnit,

    bandwidthAllowedInPlan,
    bandwidthAllowedInPlanUnit,
    bandwidthConsumedInPlan,
    bandwidthConsumedInPlanUnit,
    bandwidthConsumedInOverage,
    bandwidthConsumedInOverageUnit,
    bandwidthConsumedInOveragePrice,
    bandwidthConsumedInOveragePriceUnit,
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

const calculateAndChargeContactOverage = async ({
  companyId,
  stripeCustomerId,
  importedContactsCount,
  existingContactsCount,
}) => {
  const companiesController = require("./companies.controller");
  const plansController = require("./plans.controller");
  const overageConsumptionsController = require("./overage-consumption.controller");

  const planIds = await readPlanIds({ stripeCustomerId });

  const [company, plan, pendingInvoiceItems] = await Promise.all([
    companiesController.readCompanyById({ companyId }),
    plansController.readPlanById({ planId: planIds[0].planId }),
    readPendingInvoiceItems({ stripeCustomerId }),
  ]);

  if (plan.quota.contact < importedContactsCount + existingContactsCount) {
    const unpaidContacts =
      importedContactsCount + existingContactsCount - plan.quota.contact;

    const { priceInSmallestUnit } = plan.bundles.contact;

    const contactOverageCharge =
      Math.ceil(unpaidContacts / (priceInSmallestUnit / 100)) * 100; //converting it into cents

    let contactsOverageInvoiceItem = pendingInvoiceItems.data.find((item) =>
      item.description.includes("contact")
    );

    let pendingInvoiceItem = {};

    if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount < contactOverageCharge
    ) {
      await deleteInvoiceItem({
        invoiceItemId: contactsOverageInvoiceItem.id,
      });

      pendingInvoiceItem = await createPendingInvoiceItem({
        stripeCustomerId,
        price: contactOverageCharge,
        description: `${unpaidContacts} contacts (at $${
          contactOverageCharge / 100
        } / month)`,
      });

      overageConsumptionsController.createOverageConsumption({
        companyId: company._id,
        stripeCustomerId,
        description: "Overage charge for importing contacts above quota.",
        overageCount: `${unpaidContacts} contacts`,
        overagePrice: contactOverageCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    } else if (
      contactsOverageInvoiceItem &&
      contactsOverageInvoiceItem.amount > contactOverageCharge
    ) {
      //do nothing
    } else if (!contactsOverageInvoiceItem) {
      pendingInvoiceItem = await createPendingInvoiceItem({
        stripeCustomerId,
        price: contactOverageCharge,
        description: `${unpaidContacts} contacts (at $${
          contactOverageCharge / 100
        } / month)`,
      });

      overageConsumptionsController.createOverageConsumption({
        companyId: company._id,
        stripeCustomerId,
        description: "Overage charge for importing contacts above quota.",
        contactOverage: `${unpaidContacts} contacts`,
        contactOverageCharge,
        stripeInvoiceItemId: pendingInvoiceItem.id,
      });
    }
  }
};

module.exports = {
  createStripeCustomer,
  readSetupIntent,
  getSubscriptions,
  readActivePlansByCustomerId,
  readPlans,
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
  quotaDetails,
  readActiveBillingCycleDates,
  readTopupInvoices,
  calculateAndChargeContactOverage,
};
