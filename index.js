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

const { EmailSent } = require("./models");
const {
  constants: { ENVIRONMENT, RESPONSE_MESSAGES },
} = require("./utils");

app.use("/email-events", async (req, res) => {
  try {
    const message = JSON.parse(req.body.Message);

    console.log("WEB_HOOK_DATA", message);

    const result = await EmailSent.updateOne(
      { sesMessageId: message.mail.messageId },
      { $set: { details: message } }
    );

    if (!result.matchedCount) {
      throw createHttpError(400, {
        errorMessage: RESPONSE_MESSAGES.EMAIL_DOC_NOT_FOUND,
      });
    } else if (!result.modifiedCount) {
      console.log("Document was found but not modified.");
    }
  } catch (err) {
    console.log("Error updating document:", err);
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
