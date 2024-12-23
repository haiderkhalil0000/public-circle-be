const { Filter } = require("../models");

const {
  constants: { FILTER_STATUS },
  basicUtil,
} = require("../utils");

const createFilter = async (
  { filterLabel, filterType, filterKey, filterValues },
  { companyId }
) => {
  await Filter.create({
    company: companyId,
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
  Filter.find({ company: companyId, status: FILTER_STATUS.ACTIVE });

const readPaginatedFilters = async ({ companyId, pageNumber, pageSize }) => {
  const [totalRecords, filters] = await Promise.all([
    Filter.countDocuments({ company: companyId, status: FILTER_STATUS.ACTIVE }),
    Filter.find({ company: companyId, status: FILTER_STATUS.ACTIVE })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    filters,
  };
};

const deleteFilter = ({ filterId }) => {
  basicUtil.validateObjectId({ inputString: filterId });

  return Filter.findByIdAndUpdate(filterId, {
    status: FILTER_STATUS.DELETED,
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
