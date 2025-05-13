const express = require("express");
const Joi = require("joi");
const companyGroupingDebugger = require("debug")("debug:company-grouping");

const { authenticate, validate } = require("../middlewares");
const { companyGroupingController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, COMPANY_GROUPING_TYPES },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      type: Joi.string()
        .valid(COMPANY_GROUPING_TYPES.CAMPAIGN, COMPANY_GROUPING_TYPES.TEMPLATE)
        .required(),
      groupName: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyGrouping =
        await companyGroupingController.createCompanyGrouping({
          companyId: req.user.company._id,
          ...req.body,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_GROUPING_CREATED,
        data: companyGrouping,
      });
    } catch (err) {
      console.log(err);
      companyGroupingDebugger(err);
      next(err);
    }
  }
);

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      type: Joi.string()
        .valid(COMPANY_GROUPING_TYPES.CAMPAIGN, COMPANY_GROUPING_TYPES.TEMPLATE)
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { type } = req.query;
      const companyGrouping =
        await companyGroupingController.getCompanyGroupingByType({
          companyId: req.user.company._id,
          type,
        });
      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_GROUPING_CREATED,
        data: companyGrouping,
      });
    } catch (err) {
      console.log(err);
      companyGroupingDebugger(err);
      next(err);
    }
  }
);

router.put(
  "/:id",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      type: Joi.string()
        .valid(COMPANY_GROUPING_TYPES.CAMPAIGN, COMPANY_GROUPING_TYPES.TEMPLATE)
        .required(),
      groupName: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyGrouping =
        await companyGroupingController.patchCompanyGroupingById({
          id: req.params.id,
          ...req.body,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_GROUPING_UPDATED,
        data: companyGrouping,
      });
    } catch (err) {
      console.log(err);
      companyGroupingDebugger(err);
      next(err);
    }
  }
);

router.delete("/:id", authenticate.verifyToken, async (req, res, next) => {
  try {
    await companyGroupingController.deleteCompanyGroupingById({
      id: req.params.id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_GROUPING_DELETED,
      data: null,
    });
  } catch (err) {
    console.log(err);
    companyGroupingDebugger(err);
    next(err);
  }
});

router.get("/:id", authenticate.verifyToken, async (req, res, next) => {
  try {
    const companyGrouping = await companyGroupingController.getCompanyGroupingById({
      id: req.params.id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_GROUPING_FETCHED,
      data: companyGrouping,
    });
  } catch (err) {
    console.log(err);
    companyGroupingDebugger(err);
    next(err);
  }
});

module.exports = router;
