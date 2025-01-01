const express = require("express");
const assetDebugger = require("debug")("debug:asset");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { assetsController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, ASSETS_STATUS },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      url: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await assetsController.createAsset({
        ...req.body,
        company: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSET_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const assets = await assetsController.readAllAssets();

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_ASSETS_FETCHED,
      data: assets,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    assetDebugger(err);

    next(err);
  }
});

router.get(
  "/:assetId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      assetId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const asset = await assetsController.readAsset(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSET_FETCHED,
        data: asset,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().positive().strict().required(),
      pageSize: Joi.number().positive().strict().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const assets = await assetsController.readPaginatedAssets(req.query);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSETS_FETCHED,
        data: assets,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:assetId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      assetId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string(),
      url: Joi.string(),
      status: Joi.string()
        .required()
        .valid(ASSETS_STATUS.ACTIVE, ASSETS_STATUS.ARCHIVED),
    }),
  }),
  async (req, res, next) => {
    try {
      await assetsController.updateAsset({
        ...req.params,
        assetData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSET_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:assetId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      assetId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await assetsController.deleteAsset(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSET_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
