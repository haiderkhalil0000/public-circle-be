const express = require("express");
const Joi = require("joi");
const webhookDebugger = require("debug")("debug:webhook");

const { authenticate, validate } = require("../middlewares");
const { webhooksController } = require("../controllers");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const router = express.Router();

router.post("/email-events", async (req, res, next) => {
  try {
    console.log("body", JSON.parse(JSON.stringify(req.body)));

    res.sendStatus(200);
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    webhookDebugger(err);

    next(err);
  }
});

router.post(
  "/company-users",
  authenticate.verifyWebhookToken,
  validate({
    body: Joi.object({
      users: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await webhooksController.recieveCompanyUsersData(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_DATA_RECEIVED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      webhookDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
