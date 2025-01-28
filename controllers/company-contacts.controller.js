const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const csvParser = require("csv-parser");
const { Readable } = require("stream");

const { CompanyContact, Company } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
  basicUtil,
} = require("../utils");

const readContactKeys = async ({ companyId }) => {
  const totalDocs = await CompanyContact.countDocuments({ company: companyId });
  const sampleSize = Math.floor(totalDocs * 0.1);

  const randomDocuments = await CompanyContact.aggregate([
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

const readContactValues = async ({ companyId, key }) => {
  const [company, results] = await Promise.all([
    Company.findById(companyId),
    CompanyContact.find({ company: companyId }, { [key]: 1, _id: 0 }),
  ]);

  if (!company.contactsPrimaryKey) {
    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.PRIMARY_KEY_NOT_FOUND,
    });
  }

  const values = results.map((item) => item[key]);

  const uniqueValues = [...new Set(values)];

  return uniqueValues;
};

const readFilterCount = ({ filter, companyId }) => {
  for (let key in filter) {
    if (Array.isArray(filter[key])) {
      filter[key] = { $in: filter[key] }; // Add $in for arrays
    } else {
      filter[key] = filter[key]; // Leave as is if not an array
    }
  }

  return CompanyContact.countDocuments({
    company: companyId,
    ...filter,
  });
};

const readFiltersCount = async ({ filters, companyId }) => {
  const promises = [];

  Object.keys(filters).forEach((key) => {
    const filterValues = Array.isArray(filters[key])
      ? filters[key]
      : [filters[key]];

    const promise = CompanyContact.countDocuments({
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

  return CompanyContact.find({ company: companyId, $or: queryArray }).limit(10);
};

const readAllCompanyContacts = ({ companyId }) =>
  CompanyContact.find({ company: companyId }).select(
    "-_id -company -createdAt -updatedAt -__v"
  );

const readPaginatedCompanyContacts = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, companyContacts] = await Promise.all([
    CompanyContact.countDocuments({ company: companyId }),
    CompanyContact.find({ company: companyId })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .select("-_id -company -createdAt -updatedAt -__v"),
  ]);

  return {
    totalRecords,
    companyContacts,
  };
};

const createCompanyContact = ({ companyId, companyUserData }) => {
  CompanyContact.create({
    company: companyId,
    ...companyUserData,
  });
};

const readCompanyContact = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const companyContact = await CompanyContact.findOne({
    _id: userId,
    company: companyId,
  });

  if (!companyContact) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACT_NOT_FOUND,
    });
  }

  return companyContact;
};

const updateCompanyContact = async ({ companyId, userId, companyUserData }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const result = await CompanyContact.updateOne(
    { _id: userId, company: companyId },
    { ...companyUserData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACT_NOT_FOUND,
    });
  }
};

const deleteCompanyContact = async ({ companyId, userId }) => {
  const result = await CompanyContact.deleteOne({
    _id: userId,
    company: companyId,
  });

  if (!result.deletedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACT_DELETED_ALREADY,
    });
  }
};

const uploadCsv = async ({ companyId, stripeCustomerId, file }) => {
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
          await webhooksController.recieveCompanyContacts({
            companyId,
            stripeCustomerId,
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

const removeDuplicatesWithPrimaryKey = async ({ companyId, primaryKey }) => {
  const [companyContacts, companyContactIds] = await Promise.all([
    CompanyContact.find({ company: companyId }).lean(),
    CompanyContact.distinct("_id", { company: companyId }),
  ]);

  await CompanyContact.deleteMany({ _id: { $in: companyContactIds } });

  const uniqueContacts = basicUtil.filterUniqueObjectsFromArrayByProperty(
    companyContacts,
    primaryKey
  );

  const promises = [];

  uniqueContacts.forEach((item) => {
    promises.push(CompanyContact.create(item));
  });

  await Promise.all(promises);
};

const createPrimaryKey = async ({ companyId, primaryKey }) => {
  await Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: primaryKey,
  });

  await removeDuplicatesWithPrimaryKey({ companyId, primaryKey });
};

const readPrimaryKey = async ({ companyId }) => {
  const companyDoc = await Company.findById(companyId).select(
    "contactsPrimaryKey"
  );

  return companyDoc.contactsPrimaryKey;
};

const updatePrimaryKey = async ({ companyId, primaryKey }) => {
  await Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: primaryKey,
  });

  await removeDuplicatesWithPrimaryKey({ companyId, primaryKey });
};

const deletePrimaryKey = async ({ companyId }) =>
  Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: null,
  });

const readCompanyContactsCount = ({ companyId }) =>
  CompanyContact.countDocuments({ company: companyId });

module.exports = {
  readContactKeys,
  readContactValues,
  readFilterCount,
  readFiltersCount,
  search,
  readAllCompanyContacts,
  readPaginatedCompanyContacts,
  createCompanyContact,
  readCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
  uploadCsv,
  createPrimaryKey,
  readPrimaryKey,
  updatePrimaryKey,
  deletePrimaryKey,
  readCompanyContactsCount,
};
