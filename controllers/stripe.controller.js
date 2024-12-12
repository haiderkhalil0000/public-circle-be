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

const createSubscription = async ({ stripeCustomerId, items, couponId }) => {
  // await stripe.subscriptions.create({
  //   customer: stripeCustomerId,
  //   items,
  // });

  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const fiveMinutesLater = now + 300; // 5 minutes from now
  const tenMinutesLater = fiveMinutesLater + 300; // 5 minutes from now

  const schedule = await stripe.subscriptionSchedules.create({
    customer: stripeCustomerId,
    start_date: now, // Start immediately
    end_behavior: "release", // Continue the subscription after the schedule ends
    phases: [
      {
        items, // Discounted phase
        coupon: couponId, // Apply the coupon
        end_date: fiveMinutesLater, // Discount lasts 1 hour
      },
      {
        items, // Discounted phase
        coupon: couponId, // Apply the coupon
        end_date: tenMinutesLater, // Discount lasts 1 hour
      },
      {
        items, // Full price phase
        // No coupon in this phase
      },
    ],
  });

  console.log("Test Subscription Schedule Created:", schedule.id);
};

const createTestSubscriptionSchedule = async (customerId, items, couponId) => {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const fiveMinutesLater = now + 300; // 5 minutes from now

  const schedule = await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: now, // Start immediately
    end_behavior: "release", // Continue the subscription after the schedule ends
    phases: [
      {
        items, // Discounted phase
        coupon: couponId, // Apply the coupon
        end_date: fiveMinutesLater, // Discount lasts 1 hour
      },
      {
        items, // Full price phase
        // No coupon in this phase
      },
    ],
  });

  console.log("Test Subscription Schedule Created:", schedule.id);
};

// createTestSubscriptionSchedule(
//   "cus_RLK1cwUH08PGLu", //saad.rehman@venndii.com
//   [
//     {
//       price: "price_1QIWsMLSDdZq0edJUYPZvPcr",
//     },
//     {
//       price: "price_1QIWsALSDdZq0edJFpcwfBAB",
//     },
//     {
//       price: "price_1QIWgcLSDdZq0edJTzMJ7zK2",
//     },
//     {
//       price: "price_1QIWgJLSDdZq0edJG0rlbZbv",
//     },
//     {
//       price: "price_1QIWfwLSDdZq0edJDxIKDww5",
//     },
//   ],
//   "EQSVjObS"
// );

// const getAllCoupons = async () => {
//   try {
//     const coupons = await stripe.coupons.list({
//       limit: 10, // Optional: Number of coupons to fetch
//     });

//     console.log("Coupons:", coupons.data);
//     return coupons.data; // Returns an array of coupon objects
//   } catch (error) {
//     console.error("Error fetching coupons:", error.message);
//   }
// };

// // Example usage
// (async () => {
//   const coupons = await getAllCoupons();
//   if (coupons.length > 0) {
//     console.log(
//       "Coupon IDs:",
//       coupons.map((coupon) => coupon.id)
//     );
//   }
// })();

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
