const express = require("express");
const Joi = require("joi");
const configurationDebugger = require("debug")("debug:configuration");

const { authenticate, validate } = require("../middlewares");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { configurationsController } = require("../controllers");

const router = express.Router();

Joi.objectId = require("joi-objectid")(Joi);

router.post(
  "/email/address",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.initiateEmailVerification({
        emailAddress: req.body.emailAddress,
        companyId: req.user.company._id,
        userEmailAddress: req.user.emailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.VERIFICATION_EMAIL_SENT,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/email/address/verify",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.verifyEmailAddress(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.EMAIL_VERIFIED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/email/domain",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailDomain: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const dnsInfo = await configurationsController.initiateDomainVerification(
        {
          companyId: req.user.company._id,
          emailDomain: req.body.emailDomain,
          userEmailAddress: req.user.emailAddress,
        }
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.INITIATED_DOMAIN_VERIFICATION,
        data: dnsInfo,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/email/domain-name/verify",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailDomain: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.checkDomainVerification(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.DOMAIN_VERIFIED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddresses: Joi.array(),
      emailDomains: Joi.array(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.createConfiguration({
        companyId: req.user.company._id,
        emailAddresses: req.body.emailAddresses,
        emailDomains: req.body.emailDomains,
        userEmailAddress: req.user.emailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CONFIGURATION_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.get("/", authenticate.verifyToken, async (req, res, next) => {
  try {
    const configuration = await configurationsController.readConfigurations({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_CONFIGURATION,
      data: configuration,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    configurationDebugger(err);

    next(err);
  }
});

router.delete(
  "/email/address/:emailAddress",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      emailAddress: Joi.string().email().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.deleteEmailAddress({
        companyId: req.user.company._id,
        emailAddress: req.params.emailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.EMAIL_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/email/domain/:emailDomain",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      emailDomain: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.deleteEmailDomain({
        companyId: req.user.company._id,
        emailDomain: req.params.emailDomain,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.DOMAIN_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/email/domain/email-address",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailDomain: Joi.string().required(),
      emailAddress: Joi.string().email().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await configurationsController.attachEmailWithDomain({
        companyId: req.user.company._id,
        emailDomain: req.body.emailDomain,
        emailAddress: req.body.emailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.EMAIL_ADDED_IN_DOMAIN,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/email/verified-addresses",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const verifiedEmailAddresses =
        await configurationsController.readVerifiedEmailAddresses({
          companyId: req.user.company._id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.VERIFIED_EMAIL_FETCHED,
        data: verifiedEmailAddresses,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      configurationDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
