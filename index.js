require("dotenv").config();

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { configure, database } = require("./startup");

const app = express();

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const webhooksController = require("./controllers/webhooks.controller");

    const stripeSignature = req.headers["stripe-signature"];

    webhooksController.receiveStripeEvents({
      stripeSignature,
      body: req.body,
    });

    res.status(200).send("Success");
  }
);

app.use(helmet());
app.use(cookieParser());
app.use(cors());

// Increase payload size limit for JSON and URL-encoded data
app.use(
  express.json({
    limit: "50mb", // Adjust this value as needed
    type: ["application/json", "text/plain"],
  })
);
app.use(
  express.urlencoded({
    limit: "50mb", // Adjust this value as needed
    extended: true,
  })
);

const server = http.createServer(app);

require("./socket").initializeSocket(server);

server.timeout = 0; // Disable timeout

configure(app);
database.connect();

app.get("/", (req, res) =>
  res.status(200).json({
    message: `Server is up and running`,
  })
);

app.use(require("./routes"));

const {
  constants: { ENVIRONMENT },
} = require("./utils");

if (process.env.ENVIRONMENT !== ENVIRONMENT.LOCAL) {
  //cronJobs
  require("./cron-jobs");
}

const { PORT = 80 } = process.env;

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
