const express = require("express");
const webhookDebugger = require("debug")("debug:webhook");

const { webhooksController } = require("../controllers");

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

module.exports = router;
