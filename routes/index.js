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
router.use("/company-contacts", require("./company-contacts.route"));
router.use("/configuration", require("./configuration.route"));
router.use("/webhooks", require("./webhooks.route"));
router.use("/campaigns", require("./campaign.route"));
router.use("/campaigns-run", require("./campaign-run.route"));
router.use("/segments", require("./segments.route"));
router.use("/templates", require("./templates.route"));
router.use("/template-categories", require("./template-categories.route"));
router.use("/access-tokens", require("./access-tokens.route"));
router.use("/roles", require("./roles.route"));
router.use("/stripe", require("./stripe.route"));
router.use("/social-links", require("./social-links.route"));
router.use("/assets", require("./assets.route"));
router.use("/rewards", require("./rewards.route"));

router.use(error);

module.exports = router;
