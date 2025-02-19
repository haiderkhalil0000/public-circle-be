const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const path = require("path");

const { CompanyContact, Company } = require("../models");
const {
  constants: {
    RESPONSE_MESSAGES,
    USER_KIND,
    SOCKET_CHANNELS,
    COMPANY_CONTACT_STATUS,
  },
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

// Helper function to get a random sample from an array
const getRandomSample = (array, sampleSize) => {
  const shuffled = array.sort(() => 0.5 - Math.random()); // Shuffle the array
  return shuffled.slice(0, sampleSize); // Return the first `sampleSize` elements
};

const readContactValues = async ({
  companyId,
  key,
  pageNumber = 1,
  pageSize = 100,
  searchString,
}) => {
  if (searchString) {
    const regex = new RegExp(`${searchString}`, "i"); // 'i' for case-insensitive

    const query = {
      company: companyId,
      [key]: { $regex: regex },
    };

    const [companyContactDocs, totalResults] = await Promise.all([
      CompanyContact.find(query)
        .skip((parseInt(pageNumber) - 1) * pageSize)
        .limit(pageSize),
      CompanyContact.countDocuments(query),
    ]);

    let values = companyContactDocs.map((item) => item[key]);

    const uniqueValues = [...new Set(values)];

    return { contactValues: uniqueValues, totalResults };
  }

  const [company, results, totalResults] = await Promise.all([
    Company.findById(companyId),
    CompanyContact.find({ company: companyId }, { [key]: 1, _id: 0 })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
    CompanyContact.countDocuments({ company: companyId }, { [key]: 1, _id: 0 }),
  ]);

  if (!company.contactsPrimaryKey) {
    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.PRIMARY_KEY_NOT_FOUND,
    });
  }

  let values = results.map((item) => item[key]);

  // If total results are more than 500, sample 10% of the values
  if (values.length > 500) {
    const sampleSize = Math.ceil(values.length * 0.1); // Take 10% of the current page's values
    values = getRandomSample(values, sampleSize);
  }

  const uniqueValues = [...new Set(values)];

  return { contactValues: uniqueValues, totalResults };
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

const readFiltersCount = async ({ companyId, filters }) => {
  const promises = [];

  filters.forEach((item) => {
    if (item.values && item.values.length) {
      promises.push(
        CompanyContact.countDocuments({
          company: companyId,
          [item.key]: { $in: item.values },
        }).then((count) => ({
          key: item.key,
          values: item.conditions,
          count,
        }))
      );
    } else if (item.conditions && item.conditions.length) {
      const query = { company: companyId };

      const conditionQueries = item.conditions.map((condition) => {
        if (condition && condition.conditionType) {
          switch (condition.conditionType) {
            case "equals":
              return { [item.key]: { $eq: condition.value } };

            case "not_equals":
              return { [item.key]: { $ne: condition.value } };

            case "greater_than":
              return { [item.key]: { $gt: condition.value } };

            case "less_than":
              return { [item.key]: { $lt: condition.value } };

            case "between":
              return {
                [item.key]: {
                  $gte: condition.fromValue,
                  $lte: condition.toValue,
                },
              };

            case "contains":
              return {
                [item.key]: { $regex: condition.value, $options: "i" },
              };

            case "not_contains":
              return {
                [item.key]: {
                  $not: { $regex: condition.value, $options: "i" },
                },
              };
            case "is_timestamp":
              return { [item.key]: { $type: "date" } };

            case "is_not_timestamp":
              return { [item.key]: { $not: { $type: "date" } } };

            case "timestamp_before":
              return { [item.key]: { $lt: condition.value } };

            case "timestamp_after":
              return { [item.key]: { $gt: condition.value } };

            case "timestamp_between":
              return {
                [item.key]: {
                  $gte: condition.fromValue,
                  $lte: condition.toValue,
                },
              };
            default:
              return {};
          }
        }
        return {};
      });

      query[item.operator === "AND" ? "$and" : "$or"] = conditionQueries.filter(
        (c) => Object.keys(c).length > 0
      );

      promises.push(
        CompanyContact.countDocuments(query).then((count) => ({
          key: item.key,
          values: item.conditions,
          count: count,
        }))
      );
    }
  });

  const results = await Promise.all(promises);

  const filterCounts = [];

  results.forEach((item, index) => {
    filterCounts.push({
      filterKey: filters[index].key,
      filterValues: filters[index].values || filters[index].conditions,
      filterCount: item.count,
    });
  });

  return filterCounts;
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
  filters = [],
}) => {
  const query = {
    company: companyId,
    status: COMPANY_CONTACT_STATUS.ACTIVE,
  };

  if (filters.length) {
    query["$and"] = filters.map((filter) => ({
      [filter.filterKey]: { $in: filter.filterValues },
    }));
  }

  const [totalRecords, companyContacts] = await Promise.all([
    CompanyContact.countDocuments(query),
    CompanyContact.find(query)
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

const deleteAllCompanyContacts = async ({ companyId, currentUserKind }) => {
  if (currentUserKind !== USER_KIND.PRIMARY) {
    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.NO_RIGHTS,
    });
  }

  const result = await CompanyContact.deleteMany({
    company: companyId,
  });

  if (!result.deletedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACTS_DELETED_ALREADY,
    });
  }
};

const uploadCsv = async ({
  companyId,
  stripeCustomerId,
  currentUserId,
  file,
}) => {
  if (!file) {
    throw createHttpError(400, {
      errorMessage: "No file uploaded.",
    });
  }

  const contactsPrimaryKey = await readPrimaryKey({ companyId });

  const { Worker } = require("worker_threads");

  const workerPath = path.resolve(
    __dirname,
    "../threads/process-contacts.thread.js"
  );

  const worker = new Worker(workerPath);

  const { emitMessage, getSocket } = require("../socket");

  worker.on("message", (message) => {
    const targetSocket = getSocket({ userId: currentUserId });

    console.log(message);

    emitMessage({
      socketObj: targetSocket,
      socketChannel: SOCKET_CHANNELS.CONTACTS_UPLOAD_PROGRESS,
      message,
    });
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
    contactsPrimaryKey,
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

  await CompanyContact.deleteMany({ _id: { $in: companyContactIds } });
  await CompanyContact.insertMany(uniqueContacts);
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

const deleteSelectedContacts = async ({ companyId, contactIds }) => {
  const result = await CompanyContact.deleteMany({
    _id: { $in: contactIds },
    company: companyId,
  });

  if (!result.deletedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACTS_DELETED_ALREADY,
    });
  }
};

const getSelectionCriteriaEffect = async ({
  companyId,
  contactSelectionCriteria,
}) => {
  const query = {
    company: companyId,
    $and: contactSelectionCriteria.map((filter) => ({
      [filter.filterKey]: { $in: filter.filterValues },
    })),
  };

  const [filteredContacts, totalContacts] = await Promise.all([
    CompanyContact.countDocuments(query),
    CompanyContact.countDocuments({ company: companyId }),
  ]);

  return totalContacts - filteredContacts;
};

const filterContactsBySelectionCriteria = async ({
  companyId,
  contactSelectionCriteria,
}) => {
  const query = {
    company: companyId,
    $and: contactSelectionCriteria.map((filter) => ({
      [filter.filterKey]: { $in: filter.filterValues },
    })),
  };

  const filteredContactIds = await CompanyContact.distinct("_id", query);

  await CompanyContact.updateMany(
    { _id: { $nin: filteredContactIds }, company: companyId },
    { status: COMPANY_CONTACT_STATUS.DELETED }
  );
};

const createMultipleCompanyContacts = ({ contacts }) => {
  CompanyContact.insertMany(contacts);
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
  deleteAllCompanyContacts,
  uploadCsv,
  createPrimaryKey,
  readPrimaryKey,
  updatePrimaryKey,
  deletePrimaryKey,
  readCompanyContactsCount,
  readPrimaryKeyEffect,
  deleteSelectedContacts,
  getSelectionCriteriaEffect,
  filterContactsBySelectionCriteria,
  createMultipleCompanyContacts,
};
