const express = require("express");

const { error } = require("../middlewares");

const router = express.Router();

router.use(function (req, res, next) {
  if (req.method == "OPTIONS") {
    return res.json();
  } else {
    next();
  }
});

router.use("/auth", require("./auth.route"));
router.use("/users", require("./users.route"));
router.use("/filters", require("./filters.route"));
router.use("/company-users", require("./company-users.route"));
router.use("/configuration", require("./configuration.route"));
router.use("/webhooks", require("./webhooks.route"));

router.use(error);

module.exports = router;
