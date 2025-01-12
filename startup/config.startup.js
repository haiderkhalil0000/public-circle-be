const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const {
  ENVIRONMENT,
  MONGODB_URL,
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  PUBLIC_CIRCLES_WEB_URL,
  STRIPE_KEY,
  PUBLIC_CIRCLES_EMAIL_ADDRESS,
  S3BUCKET,
  ADMIN_ROLE_ID,
} = process.env;

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

  if (!ACCESS_TOKEN_EXPIRY) {
    console.log("FATAL ERROR: ACCESS_TOKEN_EXPIRY is not defined!");
    process.exit(1);
  }

  if (!AWS_ACCESS_KEY_ID) {
    console.log("FATAL ERROR: AWS_ACCESS_KEY_ID is not defined!");
    process.exit(1);
  }

  if (!AWS_SECRET_ACCESS_KEY) {
    console.log("FATAL ERROR: AWS_SECRET_ACCESS_KEY is not defined!");
    process.exit(1);
  }

  if (!PUBLIC_CIRCLES_WEB_URL) {
    console.log("FATAL ERROR: PUBLIC_CIRCLES_WEB_URL is not defined!");
    process.exit(1);
  }

  if (!STRIPE_KEY) {
    console.log("FATAL ERROR: STRIPE_KEY is not defined!");
    process.exit(1);
  }

  if (!PUBLIC_CIRCLES_EMAIL_ADDRESS) {
    console.log("FATAL ERROR: PUBLIC_CIRCLES_EMAIL_ADDRESS is not defined!");
    process.exit(1);
  }

  if (!S3BUCKET) {
    console.log("FATAL ERROR: S3BUCKET is not defined!");
    process.exit(1);
  }

  if (!ADMIN_ROLE_ID) {
    console.log("FATAL ERROR: ADMIN_ROLE_ID is not defined!");
    process.exit(1);
  }

  switch (ENVIRONMENT) {
    case "PRODUCTION":
      app.use(helmet());
      app.use(compression());
      app.use(morgan("tiny"));

      break;

    default:
      app.use(morgan("tiny"));
      break;
  }
};
