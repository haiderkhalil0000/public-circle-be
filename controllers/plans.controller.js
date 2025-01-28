const { Plan } = require("../models");

const readAllPlans = () => Plan.find().lean();

module.exports = {
  readAllPlans,
};
