const createHttpError = require("http-errors");
const { Filter } = require("../models");

const {
  constants: { RESPONSE_MESSAGES, DOCUMENT_STATUS },
  basicUtil,
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
    throw createHttpError(400, {
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

const readPaginatedFilters = async ({ companyId, pageNumber, pageSize }) => {
  const [totalCount, filters] = await Promise.all([
    Filter.countDocuments({ companyId, status: DOCUMENT_STATUS.ACTIVE }),
    Filter.find({ companyId, status: DOCUMENT_STATUS.ACTIVE })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    filters,
  };
};

const deleteFilter = ({ filterId }) => {
  basicUtil.validateObjectId({ inputString: filterId });

  return Filter.findByIdAndUpdate(filterId, {
    status: DOCUMENT_STATUS.DELETED,
  });
};

module.exports = {
  createFilter,
  updateFilter,
  readFilter,
  readAllFilters,
  readPaginatedFilters,
  deleteFilter,
};
