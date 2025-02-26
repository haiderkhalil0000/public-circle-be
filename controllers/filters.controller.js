const createHttpError = require("http-errors");

const { Filter } = require("../models");

const {
  constants: { FILTER_STATUS, FILTER_TYPES },
  basicUtil,
} = require("../utils");

const createFilter = (
  { filterLabel, filterType, filterKey, filterValues },
  { companyId }
) => {
  Filter.create({
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

const readPossibleFilterKeys = async ({ companyId }) => {
  const companyContactsController = require("./company-contacts.controller");

  return companyContactsController.readContactKeys({ companyId });
};

const readPossibleFilterValues = async ({
  companyId,
  pageNumber,
  pageSize,
  key,
}) => {
  const companyContactsController = require("./company-contacts.controller");

  return companyContactsController.readContactValues({
    companyId,
    key,
    pageNumber,
    pageSize,
  });
};

const paginate = ({ arr, pageNumber, pageSize }) => {
  pageNumber = Number(pageNumber);
  pageSize = Number(pageSize);

  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Slice the array to get the paginated results
  const paginatedItems = arr.slice(startIndex, endIndex);

  return paginatedItems;
};

const readPaginatedFilterValues = async ({
  filterId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const filter = await Filter.findById(filterId);

  return {
    totalRecords: filter.filterValues.length,
    filterValues: paginate({ arr: filter.filterValues, pageNumber, pageSize }),
  };
};

module.exports = {
  createFilter,
  readAllFilters,
  readPaginatedFilters,
  readFilter,
  updateFilter,
  deleteFilter,
  readPossibleFilterKeys,
  readPossibleFilterValues,
  readPaginatedFilterValues,
};
