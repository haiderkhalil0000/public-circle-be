const express = require("express");
const campaignDebugger = require("debug")("debug:webhook");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { campaignsController } = require("../controllers");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      filters: Joi.object().required(),
      sourceEmailAddress: Joi.string().email().required(),
      emailSubject: Joi.string().required(),
      emailContent: Joi.string().required(),
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

router.get(
  "/all",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const allCampaigns = await campaignsController.readAllCampaigns({
        ...req.query,
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

router.patch(
  "/:campaignId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
    body: Joi.object({
      filters: Joi.object(),
      sourceEmailAddress: Joi.string().email(),
      emailSubject: Joi.string(),
      emailContent: Joi.string(),
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

module.exports = router;
