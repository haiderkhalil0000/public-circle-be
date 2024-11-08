const express = require("express");
const socialLinkDebugger = require("debug")("debug:socialLink");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { socialLinksController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, ROLE_STATUS },
} = require("../utils");
const { SOCIAL_LINK_STATUS } = require("../utils/constants.util");

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
      await socialLinksController.createSocialLink({
        ...req.body,
        company: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SOCIAL_LINK_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      socialLinkDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const socialLinks = await socialLinksController.readAllSocialLinks();

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_SOCIAL_LINKS_FETCHED,
      data: socialLinks,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    socialLinkDebugger(err);

    next(err);
  }
});

router.get(
  "/:socialLinkId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      socialLinkId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const socialLink = await socialLinksController.readSocialLink(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.SOCIAL_LINK_FETCHED,
        data: socialLink,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      socialLinkDebugger(err);

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
      const socialLinks = await socialLinksController.readPaginatedSocialLinks(
        req.query
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.SOCIAL_LINKS_FETCHED,
        data: socialLinks,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      socialLinkDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:socialLinkId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      socialLinkId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string(),
      url: Joi.string(),
      status: Joi.string()
        .required()
        .valid(SOCIAL_LINK_STATUS.ACTIVE, SOCIAL_LINK_STATUS.ARCHIVED),
    }),
  }),
  async (req, res, next) => {
    try {
      await socialLinksController.updateSocialLink({
        ...req.params,
        socialLinkData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SOCIAL_LINK_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      socialLinkDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:socialLinkId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      socialLinkId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await socialLinksController.deleteSocialLink(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.SOCIAL_LINK_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      socialLinkDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
