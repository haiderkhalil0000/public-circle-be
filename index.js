require("dotenv").config();

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

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

app.use(require("./routes"));

const {
  constants: { ENVIRONMENT },
} = require("./utils");

if (process.env.ENVIRONMENT === ENVIRONMENT.PRODUCTION) {
  //cronJobs
  require("./cron-jobs/run-campaign.cron");
}

const { PORT = 80 } = process.env;

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
