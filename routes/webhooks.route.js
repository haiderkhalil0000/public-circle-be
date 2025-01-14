const express = require("express");
const Joi = require("joi");
const axios = require("axios");
const createHttpError = require("http-errors");
const webhookDebugger = require("debug")("debug:webhook");

const { EmailSent } = require("../models");
const { authenticate, validate } = require("../middlewares");
const { webhooksController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.post("/email-events", async (req, res, next) => {
  try {
    const messageType = req.headers["x-amz-sns-message-type"];

    // Parse the incoming SNS message
    const body = req.body;

    if (messageType === "Notification") {
      const message = JSON.parse(req.body.Message);

      const result = await EmailSent.updateOne(
        { sesMessageId: message.mail.messageId },
        [
          {
            $set: {
              emailEvents: {
                $mergeObjects: [
                  "$emailEvents",
                  { [message.eventType]: message },
                ],
              },
            },
          },
        ]
      );

      if (!result.matchedCount) {
        throw createHttpError(400, {
          errorMessage: RESPONSE_MESSAGES.EMAIL_DOC_NOT_FOUND,
        });
      } else if (!result.modifiedCount) {
        console.log("Document was found but not modified.");
      }
    } else if (messageType === "SubscriptionConfirmation") {
      const subscribeURL = body.SubscribeURL;

      await axios.get(subscribeURL);
    }
  } catch (err) {
    console.log(err);
  }

  res.sendStatus(200);
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
      await webhooksController.recieveCompanyUsersData({
        companyId: req.companyId,
        customerId: req.customerId,
        ...req.body,
      });

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

// router.post(
//   "/stripe",
//   authenticate.verifyWebhookToken,
//   async (req, res, next) => {
//     const stripeSignature = req.headers["stripe-signature"];

//     try {
//       webhooksController.receiveStripeEvents({
//         stripeSignature,
//         body: req.rawBody,
//       });
//     } catch (err) {
//       // sendErrorReportToSentry(error);
//       console.log(err);

//       webhookDebugger(err);

//       next(err);
//     }
//   }
// );

module.exports = router;
