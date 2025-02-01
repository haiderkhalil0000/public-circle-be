const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const path = require("path");

const { CompanyContact, Company } = require("../models");
const {
  constants: { RESPONSE_MESSAGES },
  basicUtil,
} = require("../utils");

const readContactKeys = async ({ companyId = "" }) => {
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

const reorderContacts = ({ contacts }) => {
  // Reorder fields to make specific ones appear at the end
  const reorderedContacts = contacts.map((contact) => {
    const { _id, company, createdAt, updatedAt, __v, ...rest } = contact;

    // Combine the fields with the rest first, then the specified ones at the end
    return { ...rest, _id, company, createdAt, updatedAt, __v };
  });

  return reorderedContacts;
};

const readAllCompanyContacts = async ({ companyId }) => {
  // Fetch the contacts including all fields
  const contacts = await CompanyContact.find({ company: companyId }).lean();

  return reorderContacts({ contacts });
};

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
      .lean(),
  ]);

  return {
    totalRecords,
    companyContacts: reorderContacts({ contacts: companyContacts }),
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
  if (!file) {
    throw createHttpError(400, {
      errorMessage: "No file uploaded.",
    });
  }

  const { Worker } = require("worker_threads");

  const workerPath = path.resolve(
    __dirname,
    "../threads/process-contacts.thread.js"
  );

  const worker = new Worker(workerPath);

  worker.on("message", (message) => {
    console.log("Message from worker:", message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });

  file.buffer = file.buffer.toString("base64"); //this is to prevent buffer to get modified in the worker thread

  worker.postMessage({
    companyId: companyId.toString(),
    stripeCustomerId,
    file,
  });
};

const findUniqueContacts = async ({ companyId, primaryKey }) => {
  const companyContacts = await CompanyContact.find({
    company: companyId,
  }).lean();

  return basicUtil.filterUniqueObjectsFromArrayByProperty(
    companyContacts,
    primaryKey
  );
};

const removeDuplicatesWithPrimaryKey = async ({ companyId, primaryKey }) => {
  const [uniqueContacts, companyContactIds] = await Promise.all([
    findUniqueContacts({ companyId, primaryKey }),
    CompanyContact.distinct("_id", { company: companyId }),
  ]);

  const promises = [];

  await CompanyContact.deleteMany({ _id: { $in: companyContactIds } });

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

const readPrimaryKeyEffect = async ({ companyId, primaryKey }) => {
  const [allContacts, uniqueContacts] = await Promise.all([
    readCompanyContactsCount({ companyId }),
    findUniqueContacts({ companyId, primaryKey }),
  ]);

  return `${allContacts - uniqueContacts.length} ${
    allContacts - uniqueContacts.length > 1 ? "contacts" : "contact"
  } will be deleted if you mark “${primaryKey}” as unique key`;
};

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
  readPrimaryKeyEffect,
};
