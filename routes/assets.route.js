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
      url: Joi.string().optional(),
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
    const assets = await assetsController.readAllAssets({
      companyId: req.user.company._id,
    });

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
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
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
  "/file-upload/:assetId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      assetId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const updatedDate = await assetsController.updateAsset({
        ...req.params,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ASSET_UPDATED,
        data: updatedDate,
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
  "/:url",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      url: Joi.string().required(),
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

router.post(
  "/file-upload-url",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      fileName: Joi.string()
        .required()
        .pattern(/\.(jpg|jpeg|png|gif|bmp)$/i)
        .message('File must be an image with one of the following extensions: .jpg, .jpeg, .png, .gif, .bmp'),
    }),
  }),
  async (req, res, next) => {
    try {
      const signedUrl = await assetsController.generateUploadFileSignedUrl({
        ...req.body,
        companyId: req.user.company._id,
      });
      res.status(200).json({
        message: RESPONSE_MESSAGES.SIGNED_URL_GENERATED,
        data: signedUrl,
      });
    } catch (err) {
      console.log(err);

      assetDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
