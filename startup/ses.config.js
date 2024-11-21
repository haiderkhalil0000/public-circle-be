const { SESClient } = require("@aws-sdk/client-ses");

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

const sesClient = new SESClient({
  region: "ca-central-1",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = {
  sesClient,
};
