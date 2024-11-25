const express = require("express");
const Joi = require("joi");
const stripeDebugger = require("debug")("debug:stripe");

const { authenticate, validate } = require("../middlewares");
const { stripeController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.post(
  "/create-payment-intent",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      amount: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    const { amount } = req.body;

    try {
      const paymentIntent = await stripeController.createPaymentIntent({
        customerId: req.user.company.stripe.id,
        amount,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PAYMENT_INTENT_CREATED,
        data: { clientSecret: paymentIntent.client_secret },
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/subscriptions",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      items: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.createSubscription({
        stripeCustomerId: req.user.company.stripe.id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SUBSCRIPTION_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/subscriptions",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const subscriptions = await stripeController.getSubscriptions(req.query);

      res.status(200).json({
        message: RESPONSE_MESSAGES.SUBSCRIPTIONS_FETCHED,
        data: subscriptions,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/active-subscriptions",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const subscriptions =
        await stripeController.getActiveSubscriptionsOfACustomer({
          customerId: req.user.company.stripe.id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SUBSCRIPTIONS_FETCHED,
        data: subscriptions,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/plans",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const products = await stripeController.getPlans(req.query);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRODUCTS_FETCHED,
        data: products,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/attach-payment-method",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      paymentMethodId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.attachPaymentMethod({
        customerId: req.user.company.stripe.id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PAYMENT_METHOD_ATTACHED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      stripeDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
