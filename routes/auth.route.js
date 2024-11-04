const express = require("express");
const Joi = require("joi");
const authDebugger = require("debug")("debug:auth");

const { authenticate, validate } = require("../middlewares");
const { authController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.post(
  "/register",
  validate({
    body: Joi.object({
      company: Joi.object({
        name: Joi.string().required(),
      }).required(),
      emailAddress: Joi.string().email().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      password: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const user = await authController.register(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_REGISTERED,
        data: {
          token: authenticate.createToken({ _id: user._id }),
          user,
        },
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/login",
  validate({
    body: Joi.object({
      emailAddress: Joi.string()
        .email()

        .required(),
      password: Joi.string().min(6).required(),
      isActivationAllowed: Joi.boolean(),
    }),
  }),

  async (req, res, next) => {
    try {
      const user = await authController.login(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_LOGGED_IN,
        data: {
          token: authenticate.createToken({ _id: user._id }),
          user,
        },
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/beefree-token",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const accessToken = await authController.getBeefreeAccessToken({
        currentUserId: req.user._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ACCESS_TOKEN_FETCHED,
        data: accessToken,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
