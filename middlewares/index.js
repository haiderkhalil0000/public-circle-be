module.exports = {
  authenticate: require("./authenticator.middleware.js"),
  validate: require("./validator.middleware"),
  upload: require("./multer.middleware.js"),
  error: require("./error.middleware.js"),
  isVerificationEmailSent: require("./is-verification-email-sent.middleware.js"),
};
