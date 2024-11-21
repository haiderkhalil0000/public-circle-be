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

const { EmailSent } = require("./models");
const {
  constants: { ENVIRONMENT },
} = require("./utils");

app.use("/emails-sent", async (req, res) => {
  try {
    const [totalCount, emailDocs] = await Promise.all([
      EmailSent.countDocuments(),
      EmailSent.find().sort({ createdAt: -1 }).limit(10),
    ]);

    res.json({
      message: "",
      data: { totalCount, emailDocs },
    });
  } catch (err) {
    console.log(err);
  }
});

app.use(require("./routes"));

if (process.env.ENVIRONMENT === ENVIRONMENT.PRODUCTION) {
  //cronJobs
  require("./cron-jobs/run-campaign.cron");
}

const { PORT = 80 } = process.env;

server.listen(PORT, () => console.log(`Server starting on port: ${PORT}`));
