const { Plan } = require("../models");

const readAllPlans = () => Plan.find().lean();

const readPlanById = ({ planId }) => Plan.findById(planId);

module.exports = {
  readAllPlans,
  readPlanById,
};
