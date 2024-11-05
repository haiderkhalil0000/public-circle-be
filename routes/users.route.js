const express = require("express");
const userDebugger = require("debug")("debug:user");

const { authenticate } = require("../middlewares");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.get("/me", authenticate.verifyToken, async (req, res, next) => {
  try {
    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_CURRENT_USER,
      data: req.user,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

    next(err);
  }
});

router.get(
  "/verify-email",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CURRENT_USER,
        data: req.user,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
