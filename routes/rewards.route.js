const express = require("express");
const Joi = require("joi");
const rewardsDebugger = require("debug")("debug:reward");

const { authenticate, validate } = require("../middlewares");
const { rewardsController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, REWARD_KIND },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      kind: Joi.string()
        .valid(
          REWARD_KIND.TRIAL,
          REWARD_KIND.FIXED_DISCOUNT,
          REWARD_KIND.PERCENTAGE_DISCOUNT
        )
        .required(),
      trialInDays: Joi.number().optional(),
      discountInDays: Joi.number().optional(),
      discounts: Joi.object({
        fixedDiscount: Joi.number().optional(),
        percentageDiscount: Joi.number().optional(),
      }).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await rewardsController.createReward(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.REWARD_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      rewardsDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
