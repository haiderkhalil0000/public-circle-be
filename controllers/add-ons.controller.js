const createHttpError = require("http-errors");

const { AddOn } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, ADD_ON_STATUS },
} = require("../utils");

const createAddOn = async ({ name, price, currency }) => {
  const existingAddOnDoc = await AddOn.findOne({
    name,
  });

  if (existingAddOnDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ADD_ON_EXISTS_ALREADY,
    });
  }

  AddOn.create({
    name,
    price,
    currency,
  });
};

const readAllAddOns = async () => AddOn.find();

const deleteAddOn = async ({ addOnId }) => {
  basicUtil.validateObjectId({ inputString: addOnId });

  const result = await AddOn.updateOne(
    { _id: addOnId },
    { status: ADD_ON_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ADD_ON_NOT_FOUND,
    });
  }
};

module.exports = {
  createAddOn,
  readAllAddOns,
  deleteAddOn,
};
