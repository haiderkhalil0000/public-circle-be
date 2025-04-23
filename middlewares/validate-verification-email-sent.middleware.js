const { EmailSent } = require("../models");
const {
  constants: { RESPONSE_MESSAGES, EMAIL_KIND },
  basicUtil,
} = require("../utils");

const { ACCESS_TOKEN_SECRET } = process.env;

module.exports = async function validateVerificationEmailSent(req, res, next) {
  const authorization = req.headers["authorization"];

  if (!authorization) {
    return res
      .status(401)
      .json({ message: RESPONSE_MESSAGES.TOKEN_IS_REQUIRED, data: {} });
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: RESPONSE_MESSAGES.TOKEN_IS_REQUIRED, data: {} });
  }

  try {
    const decodedToken = basicUtil.decodeJwt({
      jwt: token,
      jwtSecret: ACCESS_TOKEN_SECRET,
    });

    const { emailAddress,receiveEmailsFromPublicCircles } = decodedToken;

    const isVerificationEmailSent = await EmailSent.findOne({
      kind: EMAIL_KIND.VERIFICATION,
      toEmailAddress: emailAddress,
    });

    if (!isVerificationEmailSent) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
        data: {},
      });
    }

    req.emailAddress = emailAddress;
    req.receiveEmailsFromPublicCircles = receiveEmailsFromPublicCircles;

    next();
  } catch (err) {
    console.log(err);

    // sendErrorReportToSentry(err);

    return res.status(401).json({
      message: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
      data: {},
    });
  }
};
