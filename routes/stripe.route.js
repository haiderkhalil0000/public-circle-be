const express = require("express");
const Joi = require("joi");
const stripeDebugger = require("debug")("debug:stripe");

const { authenticate, validate } = require("../middlewares");
const { stripeController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

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

router.get(
  "/setup-intent",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const setupIntent = await stripeController.readSetupIntent({
        customerId: req.user.company.stripe.id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SETUP_INTENT_FETCHED,
        data: setupIntent,
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

router.post(
  "/subscriptions",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            price: Joi.string().required(),
          })
        )
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.createSubscription({
        currentUserId: req.user._id,
        customerId: req.user.company.stripe.id,
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

router.patch(
  "/subscription",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            price: Joi.string().required(),
          })
        )
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.upgradeOrDowngradeSubscription({
        customerId: req.user.company.stripe.id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SUBSCRIPTION_UPDATED,
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

router.post(
  "/top-up",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      amountInSmallestUnit: Joi.number()
        .positive()
        .strict()
        .positive()
        .strict()
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.createATopUpInCustomerBalance({
        customerId: req.user.company.stripe.id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.TOP_UP_SUCCESSFULL,
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
  "/customer-balance",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const customerBalance = await stripeController.readCustomerBalance({
        customerId: req.user.company.stripe.id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CUSTOMER_BALANCE_FETCHED,
        data: customerBalance,
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
  "/customer-balance-history",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const customerBalanceHistory =
        await stripeController.readCustomerBalanceHistory({
          customerId: req.user.company.stripe.id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CUSTOMER_BALANCE_HISTORY_FETCHED,
        data: customerBalanceHistory,
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
  "/customer-invoices",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const customerInvoices = await stripeController.readCustomerPaidInvoices({
        customerId: req.user.company.stripe.id,
        ...req.query,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.INVOICES_FETCHED,
        data: customerInvoices,
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
  "/customer-invoices/upcoming",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const upcomingInvoice =
        await stripeController.readCustomerUpcomingInvoices({
          customerId: req.user.company.stripe.id,
          ...req.query,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.INVOICES_FETCHED,
        data: upcomingInvoice,
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
  "/customer-receipts",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const customerReceipts = await stripeController.readCustomerReceipts({
        customerId: req.user.company.stripe.id,
        ...req.query,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.RECEIPTS_FETCHED,
        data: customerReceipts,
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
  "/default-payment-method",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const defaultPaymentMethod =
        await stripeController.readDefaultPaymentMethod({
          customerId: req.user.company.stripe.id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.DEFAULT_PAYMENT_METHOD_FETCHED,
        data: defaultPaymentMethod,
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
