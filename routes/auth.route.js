const express = require("express");
const Joi = require("joi");
const createHttpError = require("http-errors");
const authDebugger = require("debug")("debug:auth");

const {
  authenticate,
  validate,
  validateVerificationEmailSent,
  validateRefreshToken,
} = require("../middlewares");
const { authController, refreshTokensController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } = process.env;

const router = express.Router();

router.post(
  "/send-verification-email",
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await authController.sendVerificationEmail(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.VERIFICATION_EMAIL_SENT,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/verify-email",
  validate({
    body: Joi.object({
      token: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await authController.verifyJwtToken({
        ...req.body,
        soure: "verify-email",
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.EMAIL_VERIFIED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/register",
  validateVerificationEmailSent,
  validate({
    body: Joi.object({
      password: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const user = await authController.register({
        ...req.body,
        emailAddress: req.emailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_REGISTERED,
        data: {
          token: authenticate.generateAccessToken({
            payload: { emailAddress: user.emailAddress },
            options: { expiresIn: ACCESS_TOKEN_EXPIRY },
          }),
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
      emailAddress: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      isActivationAllowed: Joi.boolean(),
    }),
  }),

  async (req, res, next) => {
    try {
      const user = await authController.login(req.body);

      const refreshToken = authenticate.generateRefreshToken({
        payload: { _id: user._id, emailAddress: user.emailAddress },
        options: { expiresIn: REFRESH_TOKEN_EXPIRY },
      });

      refreshTokensController.storeRefreshToken({ refreshToken });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_LOGGED_IN,
        data: {
          accessToken: authenticate.generateAccessToken({
            payload: { emailAddress: user.emailAddress },
            options: { expiresIn: ACCESS_TOKEN_EXPIRY },
          }),
          refreshToken,
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
  "/change-password",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      oldPassword: Joi.string().min(6).max(20).required(),
      newPassword: Joi.string().min(6).max(20).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await authController.changePassword({
        currentUserId: req.user._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PASSWORD_CHANGED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/forgot-password",
  validate({
    body: Joi.object({
      emailOrPhoneNumber: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await authController.forgotPassword(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.PASSWORD_RESET_REQUEST_SENT,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/reset-password/:token",
  validate({
    params: Joi.object({
      token: Joi.string().required(),
    }),
    body: Joi.object({
      newPassword: Joi.string().min(6).max(20).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const decodedToken = await authController.verifyJwtToken({
        ...req.params,
        source: "reset-password",
      });

      await authController.resetPassword({
        emailAddress: decodedToken.emailAddress,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PASSWORD_RESET,
        data: {},
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

router.post(
  "/send-invitation-email",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await authController.sendInvitationEmail({
        ...req.body,
        currentUserId: req.user._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.INVITATION_EMAIL_SENT,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      authDebugger(err);

      next(err);
    }
  }
);

router.get("/token", validateRefreshToken, async (req, res, next) => {
  try {
    const refreshTokenDoc = await refreshTokensController.readRefreshToken({
      refreshToken: req.refreshToken,
    });

    if (!refreshTokenDoc) {
      throw createHttpError(403, {
        errorMessage: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      });
    }

    res.status(200).json({
      message: RESPONSE_MESSAGES.TOKEN_GENERATED,
      data: refreshTokensController.readAccessTokenFromRefreshToken({
        refreshToken: req.refreshToken,
      }),
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    authDebugger(err);

    next(err);
  }
});

router.post("/logout", validateRefreshToken, async (req, res, next) => {
  try {
    await refreshTokensController.revokeRefreshToken({
      refreshToken: req.refreshToken,
    });

    res.status(200).json({ message: "Logged out", data: {} });
  } catch (err) {
    // sendErrorReportToSentry(error);

    authDebugger(err);

    next(err);
  }
});

module.exports = router;
