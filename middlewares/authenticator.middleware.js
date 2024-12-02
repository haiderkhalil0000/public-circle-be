const jwt = require("jsonwebtoken");
// const sentry = require("@sentry/node");

const { User, Company, AccessToken } = require("../models");
const {
  constants: {
    MODELS: { ROLE },
    RESPONSE_MESSAGES,
  },
} = require("../utils");
// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

const { JWT_SECRET } = process.env;

const createToken = ({ payload, options }) => {
  return jwt.sign(payload, JWT_SECRET, options);
};

const decodeToken = (token) => jwt.verify(token, JWT_SECRET);

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
    const decodedToken = decodeToken(token);

    const { _id: userId, emailAddress } = decodedToken;

    const userQuery = {};
    const companyQuery = {};

    let user = {};
    let company = {};

    if (decodedToken._id) {
      companyQuery.user = userId;

      const [userDoc, companyDoc] = await Promise.all([
        User.findById(userId).populate(ROLE),
        Company.findOne(companyQuery),
      ]);

      user = userDoc;
      company = companyDoc;
    } else {
      userQuery.emailAddress = emailAddress;
      user = await User.findOne(userQuery).populate(ROLE);

      companyQuery.user = user._id;
      company = await Company.findOne(companyQuery);
    }

    if (!user) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    // sentry.setUser(user);
    req.user = user;
    req.user.company = company;

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

    const accessTokenDoc = await AccessToken.findOne({ _id: decodedToken._id });

    if (!accessTokenDoc) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    req.companyId = accessTokenDoc.company;

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
  createToken,
  verifyToken,
  decodeToken,
  decodeExpiredToken,
  verifyWebhookToken,
};
