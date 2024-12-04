const express = require("express");
const campaignDebugger = require("debug")("debug:campaign");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { campaignsRunController } = require("../controllers");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const router = express.Router();

router.get(
  "/stats/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaigns = await campaignsRunController.readCampaignRunsStats(
        req.params
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGN_RUN_STATS,
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

router.get(
  "/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
    query: Joi.object({
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaigns = await campaignsRunController.readPaginatedCampaignsRun({
        ...req.params,
        ...req.query,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGN_RUNS,
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

router.get(
  "/emails-sent/:campaignRunId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignRunId: Joi.string().required(),
    }),
    query: Joi.object({
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const campaignRunEmailsSent =
        await campaignsRunController.readCampaignRunEmailsSent({
          ...req.params,
          ...req.query,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CAMPAIGN_RUN_EMAIL_SENT,
        data: campaignRunEmailsSent,
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
