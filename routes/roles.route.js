const express = require("express");
const planDebugger = require("debug")("debug:plan");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { rolesController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, ROLE_STATUS },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      contactsRange: Joi.object().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.createRole(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLAN_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      planDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const plans = await rolesController.readAllPlans();

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_PLANS_FETCHED,
      data: plans,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    planDebugger(err);

    next(err);
  }
});

router.get(
  "/:planId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      planId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const plans = await rolesController.readPlan(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLAN_FETCHED,
        data: plans,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      planDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const plans = await rolesController.readPaginatedPlans(req.query);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLANS_FETCHED,
        data: plans,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      planDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:planId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      planId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string().required(),
      contactsRange: Joi.object(),
      status: Joi.string()
        .required()
        .valid(PLAN_STATUS.ACTIVE, PLAN_STATUS.ARCHIVED),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.updatePlan({
        ...req.params,
        planData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLAN_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      planDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:planId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      planId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.deletePlan(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PLAN_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      planDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
