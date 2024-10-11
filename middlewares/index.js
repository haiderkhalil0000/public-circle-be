module.exports = {
  authenticate: require("./authenticator.middleware.js"),
  validate: require("./validator.middleware"),
  upload: require("./multer.middleware.js"),
  error: require("./error.middleware.js"),
};
