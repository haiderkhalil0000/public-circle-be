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
      const plans = await stripeController.readPlans({
        ...req.query,
        stripeCustomerId: req.user.company.stripeCustomerId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLANS_FETCHED,
        data: plans,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
  "/active-plans",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const activePlans = await stripeController.readActivePlansByCustomerId({
        stripeCustomerId: req.user.company.stripeCustomerId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLANS_FETCHED,
        data: activePlans,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
      amount: Joi.number().positive().strict().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await stripeController.createATopUpInCustomerBalance({
        companyId: req.user.company._id,
        stripeCustomerId: req.user.company.stripeCustomerId,
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
        companyId: req.user.company._id,
        stripeCustomerId: req.user.company.stripeCustomerId,
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
  "/customer-stripe-balance",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const customerBalance = await stripeController.readCustomerStripeBalance({
        stripeCustomerId: req.user.company.stripeCustomerId,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
          stripeCustomerId: req.user.company.stripeCustomerId,
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
        stripeCustomerId: req.user.company.stripeCustomerId,
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
          stripeCustomerId: req.user.company.stripeCustomerId,
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

router.get(
  "/quota-details",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const quotaDetails = await stripeController.quotaDetails({
        companyId: req.user.company,
        stripeCustomerId: req.user.company.stripeCustomerId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.QUOTA_DETAILS_FETCHED,
        data: quotaDetails,
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
