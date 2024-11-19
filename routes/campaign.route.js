const express = require("express");
const campaignDebugger = require("debug")("debug:campaign");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { campaignsController } = require("../controllers");
const {
  RESPONSE_MESSAGES,
  RUN_MODE,
  CAMPAIGN_STATUS,
} = require("../utils/constants.util");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      segmentIds: Joi.array().required(),
      sourceEmailAddress: Joi.string().email().required(),
      emailSubject: Joi.string().required(),
      emailTemplateId: Joi.string().required(),
      runMode: Joi.string()
        .valid(RUN_MODE.INSTANT, RUN_MODE.SCHEDULE)
        .required(),
      runSchedule: Joi.string(),
      isRecurring: Joi.boolean(),
      recurringPeriod: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.createCampaign({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CAMPAIGN_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const allCampaigns = await campaignsController.readAllCampaigns({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ALL_CAMPAIGNS,
      data: allCampaigns,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    campaignDebugger(err);

    next(err);
  }
});

router.get(
  "/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaign = await campaignsController.readCampaign(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGN,
        data: campaign,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaigns = await campaignsController.readPaginatedCampaigns({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGNS,
        data: campaigns,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
    body: Joi.object({
      segmentIds: Joi.array().optional(),
      sourceEmailAddress: Joi.string().email().optional(),
      emailSubject: Joi.string().optional(),
      emailTemplateId: Joi.string().optional(),
      runSchedule: Joi.string().optional(),
      isRecurring: Joi.boolean().optional(),
      recurringPeriod: Joi.string().optional(),
      status: Joi.string()
        .valid(CAMPAIGN_STATUS.ACTIVE, CAMPAIGN_STATUS.DISABLED)
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.updateCampaign({
        ...req.params,
        campaignData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.UPDATED_CAMPAIGN,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.deleteCampaign(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.DELETED_CAMPAIGN,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/test-email",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      sourceEmailAddress: Joi.string().email().required(),
      toEmailAddresses: Joi.string().required(),
      emailSubject: Joi.string().required(),
      emailTemplateId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.sendTestEmail({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.TEST_EMAIL_SENT,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      campaignDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
