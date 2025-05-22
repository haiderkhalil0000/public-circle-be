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
      const emails = await emailsSentController.readEmailSentByCampaignId(
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

router.post(
  "/sent/create",
  //   authenticate.verifyToken,
  validate({
    body: Joi.object({
      companyId: Joi.string().required(),
      campaignId: Joi.string().required(),
      campaignRunId: Joi.string().required(),
      kind: Joi.string().required(),
      fromEmailAddress: Joi.string().required(),
      toEmailAddress: Joi.string().required(),
      emailSubject: Joi.string().required(),
      emailContent: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const email = await emailsSentController.createEmailSentDoc(req.body);

      res.status(200).json({
        message: "Email sent document created successfully.",
        data: email,
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
