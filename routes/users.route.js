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
  "/:currentUserId",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email(),
      password: Joi.string().min(6),
      firstName: Joi.string(),
      lastName: Joi.string(),
      companyName: Joi.string(),
      phoneNumber: Joi.string(),
      secondaryEmail: Joi.string(),
      noOfEmployees: Joi.number(),
      postalCode: Joi.number(),
      city: Joi.string(),
      province: Joi.string(),
      country: Joi.string(),
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

module.exports = router;
