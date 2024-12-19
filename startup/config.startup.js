const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const { ENVIRONMENT, MONGODB_URL, ACCESS_TOKEN_SECRET } = process.env;

module.exports = function (app) {
  if (!ENVIRONMENT) {
    console.log("FATAL ERROR: ENVIRONMENT is not defined!");
    process.exit(1);
  }

  if (!MONGODB_URL) {
    console.log("FATAL ERROR: MONGODB_URL is not defined!");
    process.exit(1);
  }

  if (!ACCESS_TOKEN_SECRET) {
    console.log("FATAL ERROR: ACCESS_TOKEN_SECRET is not defined!");
    process.exit(1);
  }

  // if (!AWS_ACCESS_KEY_ID) {
  //   console.log("FATAL ERROR: AWS_ACCESS_KEY_ID is not defined!");
  //   process.exit(1);
  // }

  // if (!AWS_SECRET_ACCESS_KEY) {
  //   console.log("FATAL ERROR: AWS_SECRET_ACCESS_KEY is not defined!");
  //   process.exit(1);
  // }

  switch (ENVIRONMENT) {
    case "PRODUCTION":
      app.use(helmet());
      app.use(compression());

      break;

    default:
      app.use(morgan("tiny"));

      break;
  }
};
