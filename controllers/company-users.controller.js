const mongoose = require("mongoose");
const _ = require("lodash");
const createHttpError = require("http-errors");
const fs = require("fs");
const csvParser = require("csv-parser");

const { CompanyUser } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
  basicUtil,
} = require("../utils");

const getPossibleFilterKeys = async ({ companyId }) => {
  const totalDocs = await CompanyUser.countDocuments();
  const sampleSize = Math.floor(totalDocs * 0.1);

  const randomDocuments = await CompanyUser.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId) } }, //this warning can be ignored.
    { $sample: { size: sampleSize } },
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
  const results = await CompanyUser.find({ companyId }, { [key]: 1, _id: 0 });

  const values = results.map((item) => item[key]);

  const uniqueValues = [...new Set(values)];

  return uniqueValues;
};

const getFiltersCount = async ({ filters }) => {
  const promises = [];

  Object.keys(filters).forEach((key) => {
    const filterValues = Array.isArray(filters[key])
      ? filters[key]
      : [filters[key]];

    const promise = CompanyUser.countDocuments({
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

  return CompanyUser.find({ companyId, $or: queryArray }).limit(10);
};

const readAllCompanyUsers = ({ companyId }) => CompanyUser.find({ companyId });

const readPaginatedCompanyUsers = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalCount, companyUsers] = await Promise.all([
    CompanyUser.countDocuments({ companyId }),
    CompanyUser.find({ companyId })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    companyUsers,
  };
};

const createCompanyUser = ({ companyId, companyUserData }) => {
  CompanyUser.create({
    companyId,
    ...companyUserData,
  });
};

const readCompanyUser = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const companyUser = await CompanyUser.findOne({ _id: userId, companyId });

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
    { _id: userId, companyId },
    { ...companyUserData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_USER_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_USER_UPDATED_ALREADY,
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
    return res.status(400).send("No file uploaded.");
  }

  const webhooksController = require("./webhooks.controller");

  // Read and parse the CSV file from disk
  fs.createReadStream(file.path)
    .pipe(csvParser()) // Parse the CSV file
    .on("data", (data) => {
      results.push(data); // Collect each row of CSV data
    })
    .on("end", async () => {
      try {
        await webhooksController.recieveCompanyUsersData({
          companyId,
          companyUsersData: results,
        });

        fs.unlink(file.path, (err) => {
          if (err) {
            console.error("Error removing file:", err);
          } else {
            console.log("File removed successfully.");
          }
        });
      } catch (err) {
        console.error(err);

        throw createHttpError(500, {
          errorMessage: "Something went wrong!",
        });
      }
    })
    .on("error", (err) => {
      console.error("Error reading CSV file:", err);

      throw createHttpError(500, {
        errorMessage: "Error reading CSV file!",
      });
    });
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
