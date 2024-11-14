require("dotenv").config();

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const createHttpError = require("http-errors");

const { configure, database } = require("./startup");

const app = express();

app.use(helmet());
app.use(express.json({ type: ["application/json", "text/plain"] }));
app.use(cors());

const server = http.createServer(app);

configure(app);
database.connect();

const { ENVIRONMENT, PORT = 80 } = process.env;

app.get("/", (req, res) =>
  res.status(200).json({
    message: `Server is up and running`,
  })
);

const axios = require("axios");
const { EmailSent } = require("./models");
const { constants } = require("./utils");

app.use("/email-events", async (req, res) => {
  try {
    const messageType = req.headers["x-amz-sns-message-type"];

    // Parse the incoming SNS message
    const body = req.body;

    console.log("email-events body:", body);
    console.log("message.mail.messageId:", message.mail.messageId);

    if (messageType === "Notification") {
      const message = JSON.parse(body.Message);

      let emailSentDoc = await EmailSent.findOne({
        sesMessageId: message.mail.messageId,
      });

      if (!emailSentDoc) {
        throw createHttpError(400, { errorMessage: "Stats document missing!" });
      }

      emailSentDoc.details = message;

      await emailSentDoc.save();
    } else if (messageType === "SubscriptionConfirmation") {
      const subscribeURL = body.SubscribeURL;

      await axios.get(subscribeURL);
    }
  } catch (err) {
    console.log(err);
  }

  res.sendStatus(200);
});

app.use(require("./routes"));

if (ENVIRONMENT === constants.ENVIRONMENT.PRODUCTION) {
  //cronJobs
  require("./cron-jobs/run-campaign.cron");
}

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
