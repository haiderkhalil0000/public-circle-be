module.exports = {
  configure: require("./config.startup"),
  database: require("./db.startup"),
  sesClient: require("./ses.config"),
};
