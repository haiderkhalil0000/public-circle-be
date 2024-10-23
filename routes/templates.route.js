const express = require("express");
const campaignDebugger = require("debug")("debug:webhook");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { templatesController } = require("../controllers");
const {
  RESPONSE_MESSAGES,
  TEMPLATE_KINDS,
} = require("../utils/constants.util");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      kind: Joi.string()
        .valid(TEMPLATE_KINDS.TEXT, TEMPLATE_KINDS.HTML)
        .required(),
      body: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await templatesController.createTemplate({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.TEMPLATE_CREATED,
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
      const templates = await templatesController.readAllTemplates({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_ALL_TEMPLATES,
        data: templates,
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
  "/:templateId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      templateId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const template = await templatesController.readTemplate(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_TEMPLATE,
        data: template,
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
  "/:templateId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      templateId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string().required(),
      kind: Joi.string()
        .valid(TEMPLATE_KINDS.TEXT, TEMPLATE_KINDS.HTML)
        .required(),
      body: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await templatesController.updateTemplate({
        ...req.params,
        templateData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.UPDATED_TEMPLATE,
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
  "/:templateId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      templateId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await templatesController.deleteTemplate(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.DELETED_TEMPLATE,
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
