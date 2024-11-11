const express = require("express");
const Joi = require("joi");
const userDebugger = require("debug")("debug:user");

const { authenticate, validate } = require("../middlewares");
const { usersController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.get("/me", authenticate.verifyToken, async (req, res, next) => {
  try {
    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_CURRENT_USER,
      data: req.user,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

    next(err);
  }
});

router.patch(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email(),
      password: Joi.string().min(6).max(20),
      firstName: Joi.string(),
      lastName: Joi.string(),
      companyName: Joi.string(),
      phoneNumber: Joi.string(),
      secondaryEmail: Joi.string(),
      companySize: Joi.string(),
      address: Joi.string(),
      postalCode: Joi.number(),
      city: Joi.string(),
      province: Joi.string(),
      country: Joi.string(),
      role: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    try {
      await usersController.updateUser({
        ...req.body,
        currentUserId: req.user._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email().required(),
      name: Joi.string().required(),
      role: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await usersController.createUserUnderACompany({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

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
      const users = await usersController.readPaginatedUsersUnderACompany({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USERS_FETCHED,
        data: users,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const users = await usersController.readAllUsersUnderACompany({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_USERS_FETCHED,
      data: users,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

    next(err);
  }
});

module.exports = router;
