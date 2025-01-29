module.exports = function (err, req, res, next) {
  console.log(err.message, err);

  res.status(err.statusCode || 500).json({
    status: err.statusCode,
    message: err.errorMessage || err.message,
    kind: err.errorKind,
  });
};
