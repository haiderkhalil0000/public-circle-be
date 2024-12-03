const { RefreshToken } = require("../models");
const { basicUtil } = require("../utils");
const { authenticate } = require("../middlewares");

const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY } = process.env;

const verifyAndDecodeRefreshToken = ({ refreshToken }) =>
  basicUtil.decodeJwt({
    jwt: refreshToken,
    jwtSecret: REFRESH_TOKEN_SECRET,
  });

const readAccessTokenFromRefreshToken = ({ refreshToken }) => {
  const decodedRefreshToken = verifyAndDecodeRefreshToken({
    refreshToken,
  });

  return authenticate.generateAccessToken({
    payload: decodedRefreshToken,
    options: { expiresIn: ACCESS_TOKEN_EXPIRY },
  });
};

const storeRefreshToken = async ({ refreshToken }) => {
  await RefreshToken.create({ token: refreshToken });
};

const readRefreshToken = ({ refreshToken }) =>
  RefreshToken.findOne({ token: refreshToken });

const revokeRefreshToken = async ({ token }) => {
  await RefreshToken.findOneAndDelete({ token });
};

module.exports = {
  readAccessTokenFromRefreshToken,
  readRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
};
