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

app.get("/", (req, res) =>
  res.status(200).json({
    message: `Server is up and running`,
  })
);

const axios = require("axios");
const { EmailSent } = require("./models");
const {
  constants: { ENVIRONMENT, EMAIL_DOC_NOT_FOUND },
} = require("./utils");

app.use("/email-events", async (req, res) => {
  try {
    console.log("request_webhook", req);
    const messageType = req.headers["x-amz-sns-message-type"];

    // Parse the incoming SNS message
    const body = req.body;

    // if (messageType === "Notification") {
    const message = JSON.parse(body.Message);

    let emailSentDoc = await EmailSent.findOne({
      sesMessageId: message.mail.messageId,
    });

    if (!emailSentDoc) {
      throw createHttpError(400, { errorMessage: EMAIL_DOC_NOT_FOUND });
    }

    emailSentDoc.details = message;

    await emailSentDoc.save();
    // } else if (messageType === "SubscriptionConfirmation") {
    //   const subscribeURL = body.SubscribeURL;

    //   await axios.get(subscribeURL);
    // }
  } catch (err) {
    console.log(err);
  }

  res.sendStatus(200);
});

app.use(require("./routes"));

if (process.env.ENVIRONMENT === ENVIRONMENT.PRODUCTION) {
  //cronJobs
  require("./cron-jobs/run-campaign.cron");
}

const { PORT = 80 } = process.env;

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
