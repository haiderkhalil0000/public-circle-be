const mongoose = require("mongoose");
const _ = require("lodash");
const createHttpError = require("http-errors");
const fs = require("fs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");

const { CompanyUser } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
  basicUtil,
} = require("../utils");

const getPossibleFilterKeys = async ({ companyId = "" }) => {
  const totalDocs = await CompanyUser.countDocuments({ company: companyId });
  const sampleSize = Math.floor(totalDocs * 0.1);

  const randomDocuments = await CompanyUser.aggregate([
    { $match: { company: new mongoose.Types.ObjectId(companyId) } },
    { $sample: { size: sampleSize ? sampleSize : 1 } },
  ]);

  if (!randomDocuments.length) {
    return [];
  }

  const allKeys = randomDocuments.reduce((commonKeys, doc) => {
    const docKeys = Object.keys(doc);
    return commonKeys.filter((key) => docKeys.includes(key));
  }, Object.keys(randomDocuments[0]));

  return allKeys.filter(
    (item) => item !== "_id" && item !== "__v" && item !== "companyId"
  );
};

const getPossibleFilterValues = async ({ companyId, key }) => {
  const results = await CompanyUser.find(
    { company: companyId },
    { [key]: 1, _id: 0 }
  );

  const values = results.map((item) => item[key]);

  const uniqueValues = [...new Set(values)];

  return uniqueValues;
};

const getFiltersCount = async ({ filters, companyId }) => {
  const promises = [];

  Object.keys(filters).forEach((key) => {
    const filterValues = Array.isArray(filters[key])
      ? filters[key]
      : [filters[key]];

    const promise = CompanyUser.countDocuments({
      company: companyId,
      [key]: Array.isArray(filters[key]) ? { $in: filters[key] } : filters[key],
    }).then((count) => ({
      filterKey: key,
      filterValues: filterValues,
      filterCount: count,
    }));

    promises.push(promise);
  });

  return Promise.all(promises);
};

const search = async ({ companyId, searchString, searchFields }) => {
  const regex = new RegExp(`^${searchString}`, "i"); // 'i' for case-insensitive

  const queryArray = [];

  searchFields.forEach((item) => {
    queryArray.push({ [item]: { $regex: regex } });
  });

  return CompanyUser.find({ company: companyId, $or: queryArray }).limit(10);
};

const readAllCompanyUsers = ({ companyId }) =>
  CompanyUser.find({ company: companyId });

const readPaginatedCompanyUsers = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, companyUsers] = await Promise.all([
    CompanyUser.countDocuments({ company: companyId }),
    CompanyUser.find({ company: companyId })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    companyUsers,
  };
};

const createCompanyUser = ({ companyId, companyUserData }) => {
  CompanyUser.create({
    company: companyId,
    ...companyUserData,
  });
};

const readCompanyUser = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const companyUser = await CompanyUser.findOne({
    _id: userId,
    company: companyId,
  });

  if (!companyUser) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_USER_NOT_FOUND,
    });
  }

  return companyUser;
};

const updateCompanyUser = async ({ companyId, userId, companyUserData }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const result = await CompanyUser.updateOne(
    { _id: userId, company: companyId },
    { ...companyUserData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_USER_NOT_FOUND,
    });
  }
};

const deleteCompanyUser = async ({ userId }) => {
  const result = await CompanyUser.deleteOne({
    _id: userId,
  });

  if (!result.deletedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_USER_DELETED_ALREADY,
    });
  }
};

const uploadCsv = async ({ companyId, file }) => {
  const results = [];

  if (!file) {
    throw createHttpError(400, {
      errorMessage: "No file uploaded.",
    });
  }

  const webhooksController = require("./webhooks.controller");

  try {
    // Convert the buffer into a readable stream
    const fileStream = Readable.from(file.buffer);

    // Parse the CSV from the buffer
    fileStream
      .pipe(csvParser())
      .on("data", (data) => {
        results.push(data); // Collect each row of CSV data
      })
      .on("end", async () => {
        try {
          // Pass the parsed data to the controller
          await webhooksController.recieveCompanyUsersData({
            companyId,
            users: results,
          });
        } catch (err) {
          console.error("Error processing CSV data:", err);
          throw createHttpError(500, {
            errorMessage: "Something went wrong while processing the CSV!",
          });
        }
      })
      .on("error", (err) => {
        console.error("Error reading CSV buffer:", err);
        throw createHttpError(500, {
          errorMessage: "Error reading CSV data!",
        });
      });
  } catch (err) {
    console.error("Unexpected error:", err);
    throw createHttpError(500, {
      errorMessage: "Unexpected error occurred!",
    });
  }
};

module.exports = {
  getPossibleFilterKeys,
  getPossibleFilterValues,
  getFiltersCount,
  search,
  readAllCompanyUsers,
  readPaginatedCompanyUsers,
  createCompanyUser,
  readCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  uploadCsv,
};
