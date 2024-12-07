const { RefreshToken } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

module.exports = async function validateRefreshToken(req, res, next) {
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
    const refreshTokenDoc = await RefreshToken.findOne({ token });

    if (!refreshTokenDoc) {
      return res.status(401).json({
        message: RESPONSE_MESSAGES.TOKEN_IS_INVALID_OR_EXPIRED,
        data: {},
      });
    }

    req.refreshToken = refreshTokenDoc.token;

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
