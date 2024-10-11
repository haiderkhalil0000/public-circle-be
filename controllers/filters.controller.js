const createError = require("http-errors");
const { Filter } = require("../models");

const {
  constants: { RESPONSE_MESSAGES, DOCUMENT_STATUS },
} = require("../utils");

const createFilter = async (
  { filterLabel, filterType, filterKey, filterValues },
  { companyId }
) => {
  const isFilterExists = await Filter.findOne({
    companyId,
    filterKey,
    status: DOCUMENT_STATUS.ACTIVE,
  });

  if (isFilterExists) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.FILTER_ALREADY_EXISTS,
    });
  }

  Filter.create({
    companyId,
    filterLabel,
    filterType,
    filterKey,
    filterValues,
  });
};

const updateFilter = (
  { filterId },
  { filterLabel, filterType, filterKey, filterValues }
) =>
  Filter.findByIdAndUpdate(filterId, {
    filterLabel,
    filterType,
    filterKey,
    filterValues,
  });

const readFilter = ({ filterId }) => Filter.findById(filterId);

const readAllFilters = ({ companyId }) =>
  Filter.find({ companyId, status: DOCUMENT_STATUS.ACTIVE });

const deleteFilter = ({ filterId }) =>
  Filter.findByIdAndUpdate(filterId, { status: DOCUMENT_STATUS.DELTED });

module.exports = {
  createFilter,
  updateFilter,
  readFilter,
  readAllFilters,
  deleteFilter,
};
