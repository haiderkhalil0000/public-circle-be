const { Plan } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, PLAN_STATUS },
} = require("../utils");

const createPlan = async ({ name, contactsRange, price }) => {
  const existingPlanDoc = await Plan.findOne({
    name,
  });

  if (existingPlanDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.PLAN_EXISTS_ALREADY,
    });
  }

  Plan.create({
    name,
    contactsRange,
    price,
  });
};

const readAllPlans = () => Plan.find();

const readPaginatedPlans = async ({ pageNumber, pageSize }) => {
  const [totalCount, plans] = await Promise.all([
    Plan.countDocuments(),
    Plan.find()
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    plans,
  };
};

const readPlan = async ({ planId }) => {
  basicUtil.validateObjectId({ inputString: planId });

  const planDoc = await Plan.findById(planId);

  if (!planDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.PLAN_NOT_FOUND,
    });
  }

  return planDoc;
};

const updatePlan = async ({ planId, planData }) => {
  basicUtil.validateObjectId({ inputString: planId });

  const result = await Plan.updateOne({ _id: planId }, { ...planData });

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.PLAN_NOT_FOUND,
    });
  }
};

const deletePlan = async ({ planId }) => {
  basicUtil.validateObjectId({ inputString: planId });

  const result = await Plan.updateOne(
    { _id: planId },
    { status: PLAN_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.PLAN_NOT_FOUND,
    });
  }
};

module.exports = {
  createPlan,
  readAllPlans,
  readPaginatedPlans,
  readPlan,
  updatePlan,
  deletePlan,
};
