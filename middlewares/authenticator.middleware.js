const jwt = require("jsonwebtoken");
// const sentry = require("@sentry/node");

const { User, AccessToken, Company } = require("../models");
const {
  constants: {
    MODELS: { ROLE },
    RESPONSE_MESSAGES,
  },
} = require("../utils");
// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;

const generateAccessToken = ({ payload, options }) => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, options);
};

const generateRefreshToken = ({ payload, options }) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, options);
};

const decodeToken = (token) => jwt.verify(token, ACCESS_TOKEN_SECRET);

const verifyToken = async (req, res, next) => {
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
    const decodedToken = decodeToken(token) ?? {};

    const { emailAddress } = decodedToken;

    const userDoc = await User.findOne({ emailAddress })
      .populate("company")
      .populate(ROLE);

    if (!userDoc) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    // sentry.setUser(user);

    req.user = userDoc;

    next();
  } catch (err) {
    // sendErrorReportToSentry(err);

    console.log(err);

    return res.status(401).json({
      message: RESPONSE_MESSAGES.INVALID_TOKEN,
      data: {},
    });
  }
};

const verifyWebhookToken = async (req, res, next) => {
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
    const decodedToken = decodeToken(token);

    const accessTokenDoc = await AccessToken.findOne({
      _id: decodedToken._id,
    });

    const companyDoc = await Company.findOne({
      _id: accessTokenDoc.company,
    });

    if (!accessTokenDoc) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    req.companyId = companyDoc._id;
    req.stripeCustomerId = companyDoc.stripeCustomerId;

    next();
  } catch (err) {
    // sendErrorReportToSentry(err);
    console.log(err);

    return res.status(401).json({
      message: RESPONSE_MESSAGES.INVALID_TOKEN,
      data: {},
    });
  }
};

const decodeExpiredToken = async (req, res, next) => {
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
    const decodedToken = jwt.decode(token, { complete: true });

    if (!decodedToken.payload.emailAddress) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    req.user = {};
    req.user.emailAddress = decodedToken.payload.emailAddress;

    next();
  } catch (err) {
    // sendErrorReportToSentry(err);
    console.log(err);

    return res.status(401).json({
      message: RESPONSE_MESSAGES.INVALID_TOKEN,
      data: {},
    });
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  decodeExpiredToken,
  verifyWebhookToken,
};
