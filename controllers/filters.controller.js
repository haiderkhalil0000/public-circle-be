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

module.exports = {
  createFilter,
  readAllFilters,
  readPaginatedFilters,
  readFilter,
  updateFilter,
  deleteFilter,
  readPossibleFilterKeys,
  readPossibleFilterValues,
};
