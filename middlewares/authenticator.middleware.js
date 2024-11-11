const jwt = require("jsonwebtoken");
// const sentry = require("@sentry/node");

const { User, Company } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

const { JWT_SECRET } = process.env;

const createToken = (data) => jwt.sign(data, JWT_SECRET, { expiresIn: "10m" });

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

    const { _id: userId } = decodedToken;

    const [user, company] = await Promise.all([
      User.findById(userId),
      Company.findOne({ user: userId }),
    ]);

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

const verifyEmailToken = async (req, res, next) => {
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

    if (!decodedToken.emailAddress) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.INVALID_TOKEN,
        data: {},
      });
    }

    req.user = {};
    req.user.emailAddress = decodedToken.emailAddress;

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
  verifyToken,
  createToken,
  decodeToken,
  decodeExpiredToken,
  verifyEmailToken,
};
