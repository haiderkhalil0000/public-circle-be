const express = require("express");
const campaignDebugger = require("debug")("debug:webhook");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { segmentsController } = require("../controllers");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      filters: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await segmentsController.createSegment({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SEGMENT_CREATED,
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
    const segments = await segmentsController.readAllSegments({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ALL_SEGMENTS,
      data: segments,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    campaignDebugger(err);

    next(err);
  }
});

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
      const segments = await segmentsController.readPaginatedSegments({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_SEGMENTS,
        data: segments,
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
  "/:segmentId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      segmentId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const segment = await segmentsController.readSegment(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_SEGMENT,
        data: segment,
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
  "/:segmentId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      segmentId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string(),
      filters: Joi.object(),
    }),
  }),
  async (req, res, next) => {
    try {
      await segmentsController.updateSegment({
        ...req.params,
        segmentData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.UPDATED_SEGMENT,
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
  "/:segmentId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      segmentId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await segmentsController.deleteSegment(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.DELETED_SEGMENT,
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
