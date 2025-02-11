const express = require("express");
const Joi = require("joi");
const emailsSentDebugger = require("debug")("debug:emails-sent");

const { authenticate, validate } = require("../middlewares");
const { emailsSentController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, REWARD_KIND },
} = require("../utils");

const router = express.Router();

router.get(
  "/:campaignId",
  //   authenticate.verifyToken,
  validate({
    params: Joi.object({
      campaignId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const emails = await emailsSentController.readEmailsSentByCampaignId(
        req.params
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.EMAILS_FETCHED,
        data: emails,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      emailsSentDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
