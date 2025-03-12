const express = require("express");
const campaignDebugger = require("debug")("debug:campaign");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { campaignsController, emailsSentController } = require("../controllers");
const {
  constants: {
    RESPONSE_MESSAGES,
    RUN_MODE,
    CAMPAIGN_STATUS,
    SORT_ORDER,
    CAMPAIGN_FREQUENCIES,
  },
} = require("../utils");

const router = express.Router();

router.get(
  "/usage-details",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const campaignUsageDetails =
        await campaignsController.readCampaignUsageDetails({
          companyId: req.user.company._id,
          stripeCustomerId: req.user.company.stripeCustomerid,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CAMPAIGN_USAGE_DETAILS_FETCHED,
        data: campaignUsageDetails,
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
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      segmentIds: Joi.array(),
      sourceEmailAddress: Joi.string().email().required(),
      emailSubject: Joi.string().required(),
      emailTemplateId: Joi.string().required(),
      runMode: Joi.string()
        .valid(RUN_MODE.INSTANT, RUN_MODE.SCHEDULE)
        .required(),
      runSchedule: Joi.string(),
      isRecurring: Joi.boolean(),
      isOnGoing: Joi.boolean(),
      recurringPeriod: Joi.string(),
      frequency: Joi.string()
        .valid(CAMPAIGN_FREQUENCIES.ONE_TIME, CAMPAIGN_FREQUENCIES.MANY_TIMES)
        .required(),
      status: Joi.string().valid(
        CAMPAIGN_STATUS.ACTIVE,
        CAMPAIGN_STATUS.DISABLED
      ),
    }).custom((value, helpers) => {
      if (value.isOnGoing && value.isRecurring) {
        return helpers.message("Either isOnGoing or isRecurring can be true, not both.");
      }
      return value;
    }),
  }),
  async (req, res, next) => {
    try {
      const campaign = await campaignsController.createCampaign({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CAMPAIGN_CREATED,
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
  "/all",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid(SORT_ORDER.ASC, SORT_ORDER.DSC).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const allCampaigns = await campaignsController.readAllCampaigns({
        companyId: req.user.company._id,
        ...req.query,
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
  }
);

router.get(
  "/logs/all",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaignLogs = await campaignsController.readAllCampaignLogs({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CAMPAIGN_LOGS_FETCHED,
        data: campaignLogs,
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
  "/logs",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaignLogs = await campaignsController.readPaginatedCampaignLogs({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CAMPAIGN_LOGS_FETCHED,
        data: campaignLogs,
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
  "/:campaignId/email-addresses",
  // authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const emailAddresses =
        await emailsSentController.readEmailAddressesByCampaignId(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGN,
        data: emailAddresses,
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
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid(SORT_ORDER.ASC, SORT_ORDER.DSC).optional(),
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
      runMode: Joi.string()
        .valid(RUN_MODE.INSTANT, RUN_MODE.SCHEDULE)
        .optional(),
      runSchedule: Joi.string().optional(),
      isRecurring: Joi.boolean().optional(),
      isOnGoing: Joi.boolean().optional(),
      recurringPeriod: Joi.string().optional(),
      status: Joi.string()
        .valid(CAMPAIGN_STATUS.ACTIVE, CAMPAIGN_STATUS.DISABLED)
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.updateCampaign({
        companyId: req.user.company._id,
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
      campaignId: Joi.string().required(),
      sourceEmailAddress: Joi.string().email().required(),
      toEmailAddresses: Joi.string().required(),
      emailSubject: Joi.string().required(),
      emailTemplateId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await campaignsController.sendTestEmail({
        companyId: req.user.company._id,
        ...req.body,
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
