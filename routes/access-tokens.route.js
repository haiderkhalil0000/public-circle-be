const express = require("express");
const Joi = require("joi");
const accessTokenDebugger = require("debug")("debug:access-token");

const { authenticate, validate } = require("../middlewares");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { accessTokensController } = require("../controllers");
const { DOCUMENT_STATUS } = require("../utils/constants.util");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      title: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const accessToken = await accessTokensController.createAccessToken({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ACCESS_TOKEN_CREATED,
        data: accessToken,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      accessTokenDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const accessTokens = await accessTokensController.readAllAccessTokens({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ACCESS_TOKENS,
      data: accessTokens,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    accessTokenDebugger(err);

    next(err);
  }
});

router.get(
  "/:accessTokenId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      accessTokenId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const accessToken = await accessTokensController.readAccessToken({
        companyId: req.user.company._id,
        ...req.params,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_ACCESS_TOKEN,
        data: accessToken,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      accessTokenDebugger(err);

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
      const accessTokens =
        await accessTokensController.readPaginatedAccessTokens({
          companyId: req.user.company._id,
          ...req.query,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_ACCESS_TOKENS,
        data: accessTokens,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      accessTokenDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:accessTokenId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      accessTokenId: Joi.string().required(),
    }),
    body: Joi.object({
      title: Joi.string().required(),
      status: Joi.string()
        .valid(DOCUMENT_STATUS.ACTIVE, DOCUMENT_STATUS.ARCHIVED)
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await accessTokensController.updateAccessToken({
        companyId: req.user.company._id,
        ...req.params,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ACCESS_TOKEN_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      accessTokenDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:accessTokenId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      accessTokenId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await accessTokensController.deleteAccessToken({
        companyId: req.user.company._id,
        ...req.params,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ACCESS_TOKEN_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      accessTokenDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
