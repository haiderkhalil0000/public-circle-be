require("dotenv").config();

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const createError = require("http-errors");

const { configure, database } = require("./startup");
const { companyUsersController } = require("./controllers");

const app = express();

app.use(helmet());
app.use(express.json({ type: ["application/json", "text/plain"] }));
app.use(cors());

const server = http.createServer(app);

configure(app);
database.connect();

const { PORT = 80 } = process.env;

app.get("/", (req, res) =>
  res.status(200).json({
    message: `Server is up and running`,
  })
);

const axios = require("axios");
const { EMAIL_STATS } = require("./models");

app.use("/email-events", async (req, res) => {
  try {
    const messageType = req.headers["x-amz-sns-message-type"];

    // Parse the incoming SNS message
    const body = req.body;

    if (messageType === "Notification") {
      const message = JSON.parse(body.Message);

      let statDoc = await EMAIL_STATS.findOne({
        fromEmailAddress: message.mail.source,
        toEmailAddress: message.mail.destination[0],
      });

      if (!statDoc) {
        throw createError(400, { errorMessage: "Stats document missing!" });
      }

      statDoc.details = message;

      console.log(statDoc);

      await statDoc.save();
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

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
