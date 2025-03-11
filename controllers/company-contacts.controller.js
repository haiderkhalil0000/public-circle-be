const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const path = require("path");
const _ = require("lodash");

const { CompanyContact, Company } = require("../models");
const {
  constants: {
    RESPONSE_MESSAGES,
    USER_KIND,
    SOCKET_CHANNELS,
    COMPANY_CONTACT_STATUS,
    FILTER_CONDITION_CASES,
  },
  basicUtil,
} = require("../utils");
const { isNumericString } = require("../utils/basic.util");

const readContactKeys = async ({ companyId = "" }) => {
  const totalDocs = await CompanyContact.countDocuments({
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
  });

  const latestDocument = await CompanyContact.aggregate([
    {
      $match: {
        public_circles_company: new mongoose.Types.ObjectId(companyId),
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      },
    },
    {
      $sort: { public_circles_createdAt: -1 },
    },
    {
      $limit: 1,
    },
  ]);
  

  if (!latestDocument.length) {
    return [];
  }

  const allKeys = latestDocument.reduce((commonKeys, doc) => {
    const docKeys = Object.keys(doc);
    return commonKeys.filter((key) => docKeys.includes(key));
  }, Object.keys(latestDocument[0]));

  return allKeys.filter(
    (item) =>
      !item.startsWith("public_circles_") && item !== "_id" && item !== "__v"
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
      public_circles_company: companyId,
      public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
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
    CompanyContact.find(
      {
        public_circles_company: companyId,
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      },
      { [key]: 1, _id: 0 }
    )
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
    CompanyContact.countDocuments(
      {
        public_circles_company: companyId,
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      },
      { [key]: 1, _id: 0 }
    ),
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
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    ...filter,
  });
};

const getFilterConditionQuery = ({ conditions, conditionKey }) => {
  const {
    EQUALS,
    NOT_EQUALS,
    GREATER_THAN,
    LESS_THAN,
    BETWEEN,
    CONTAINS,
    NOT_CONTAINS,
    IS_TIMESTAMP,
    IS_NOT_TIMESTAMP,
    TIMESTAMP_BEFORE,
    TIMESTAMP_AFTER,
    TIMESTAMP_BETWEEN,
  } = FILTER_CONDITION_CASES;

  return conditions.map((condition) => {
    const value = condition.value;
    const fromValue = condition.fromValue;
    const toValue = condition.toValue;

    const numericComparison =
      isNumericString(value) ||
      isNumericString(fromValue) ||
      isNumericString(toValue);

      switch (condition.conditionType) {
        case EQUALS:
          return numericComparison && !isNaN(value)
            ? {
                $expr: {
                  $eq: [
                    {
                      $convert: {
                        input: { $trim: { input: `$${conditionKey}` } },
                        to: "double",
                        onError: "$$REMOVE",
                        onNull: "$$REMOVE",
                      },
                    },
                    parseFloat(value),
                  ],
                },
              }
            : {
                [conditionKey]: value.toString().trim(),
              };
        
        case NOT_EQUALS:
          return numericComparison && !isNaN(value)
            ? {
                $expr: {
                  $ne: [
                    {
                      $convert: {
                        input: { $trim: { input: `$${conditionKey}` } },
                        to: "double",
                        onError: "$$REMOVE",
                        onNull: "$$REMOVE",
                      },
                    },
                    parseFloat(value),
                  ],
                },
              }
            : {
                [conditionKey]: { $ne: value.toString().trim() },
              };
        case GREATER_THAN:
          return numericComparison
            ? {
                $expr: {
                  $gt: [
                    {
                      $convert: {
                        input: `$${conditionKey}`,
                        to: "int",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                    parseInt(value, 10),
                  ],
                },
              }
            : { [conditionKey]: { $gt: value } };
      
        case LESS_THAN:
          return numericComparison
            ? {
                $expr: {
                  $lt: [
                    {
                      $convert: {
                        input: `$${conditionKey}`,
                        to: "int",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                    parseInt(value, 10),
                  ],
                },
              }
            : { [conditionKey]: { $lt: value } };
      
        case BETWEEN:
          return numericComparison
            ? {
                $expr: {
                  $and: [
                    {
                      $gte: [
                        {
                          $convert: {
                            input: `$${conditionKey}`,
                            to: "int",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        parseInt(fromValue, 10),
                      ],
                    },
                    {
                      $lte: [
                        {
                          $convert: {
                            input: `$${conditionKey}`,
                            to: "int",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        parseInt(toValue, 10),
                      ],
                    },
                  ],
                },
              }
            : {
                [conditionKey]: {
                  $gte: fromValue,
                  $lte: toValue,
                },
              };
      
        case CONTAINS:
          return {
            [conditionKey]: { $regex: value, $options: "i" },
          };
      
        case NOT_CONTAINS:
          return {
            [conditionKey]: {
              $not: { $regex: value, $options: "i" },
            },
          };
      
        case IS_TIMESTAMP:
          return { [conditionKey]: { $type: "date" } };
      
        case IS_NOT_TIMESTAMP:
          return { [conditionKey]: { $not: { $type: "date" } } };
      
        case TIMESTAMP_BEFORE:
          return {
            $expr: {
              $gt: [
                `$${conditionKey}`,
                { $dateFromString: { dateString: value } },
              ],
            },
          };
      
        case TIMESTAMP_AFTER:
          return {
            $expr: {
              $lt: [
                `$${conditionKey}`,
                { $dateFromString: { dateString: value } },
              ],
            },
          };
      
        case TIMESTAMP_BETWEEN:
          return {
            $expr: {
              $and: [
                {
                  $gte: [
                    `$${conditionKey}`,
                    { $dateFromString: { dateString: fromValue } },
                  ],
                },
                {
                  $lte: [
                    `$${conditionKey}`,
                    { $dateFromString: { dateString: toValue } },
                  ],
                },
              ],
            },
          };
      
        default:
          return {};
      }
      
  });
};

const readFiltersCount = async ({ companyId, filters }) => {
  const promises = [];

  filters.forEach((item) => {
    if (item.values && item.values.length) {
      promises.push(
        CompanyContact.countDocuments({
          public_circles_company: companyId,
          public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
          [item.key]: { $in: item.values },
        }).then((count) => ({
          key: item.key,
          values: item.conditions,
          count,
        }))
      );
    } else if (item.conditions && item.conditions.length) {
      const query = {
        public_circles_company: companyId,
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      };

      const filterConditionQueries = getFilterConditionQuery({
        conditions: item.conditions,
        conditionKey: item.key,
      });

      query[item.operator === "AND" ? "$and" : "$or"] =
        filterConditionQueries.filter((c) => Object.keys(c).length > 0);

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

  return CompanyContact.find({
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    $or: queryArray,
  }).limit(10);
};

const reorderContacts = ({ contacts }) => {
  // Reorder fields to make specific ones appear at the end
  const reorderedContacts = contacts.map((contact) => {
    const {
      _id,
      public_circles_company,
      public_circles_createdAt,
      public_circles_updatedAt,
      __v,
      ...rest
    } = contact;

    // Combine the fields with the rest first, then the specified ones at the end
    return {
      ...rest,
      _id,
      public_circles_company,
      public_circles_createdAt,
      public_circles_updatedAt,
      __v,
    };
  });

  return reorderedContacts;
};

const readAllCompanyContacts = async ({ companyId }) => {
  // Fetch the contacts including all fields
  const contacts = await CompanyContact.find({
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
  }).lean();

  return reorderContacts({ contacts });
};

const readPaginatedCompanyContacts = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
  filters = [],
}) => {
  const query = {
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
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

  const reorderedContacts = reorderContacts({ contacts: companyContacts });
  const filteredContacts = reorderedContacts.map(filterInternalKeys);
  
  return {
    totalRecords,
    companyContacts: filteredContacts,
  };
};

const createCompanyContact = ({ companyId, companyUserData }) => {
  CompanyContact.create({
    public_circles_company: companyId,
    ...companyUserData,
  });
};

const readCompanyContact = async ({ companyId, userId }) => {
  basicUtil.validateObjectId({
    inputString: userId,
  });

  const companyContact = await CompanyContact.findOne({
    _id: userId,
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
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
    { _id: userId, public_circles_company: companyId },
    { ...companyUserData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_CONTACT_NOT_FOUND,
    });
  }
};

const deleteCompanyContact = async ({ companyId, userId }) => {
  const result = await CompanyContact.updateOne(
    {
      _id: userId,
      public_circles_company: companyId,
    },
    { public_circles_status: COMPANY_CONTACT_STATUS.DELETED }
  );

  if (!result.modifiedCount) {
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

  const result = await CompanyContact.updateMany(
    {
      public_circles_company: companyId,
    },
    { public_circles_status: COMPANY_CONTACT_STATUS.DELETED }
  );

  if (!result.modifiedCount) {
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
  const getCompanyContacts = await readAllCompanyContacts({ companyId });

  if (!contactsPrimaryKey && getCompanyContacts.length) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ADD_PRIMARY_KEY_FOR_NEXT_IMPORTS,
    });
  }

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
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
  }).lean();

  return basicUtil.filterUniqueObjectsFromArrayByProperty(
    companyContacts,
    primaryKey
  );
};

const markContactsDuplicateWithPrimaryKey = async ({
  companyId,
  primaryKey,
  getCountsOnly = false
}) => {
  let [uniqueContacts, allCompanyContacts] = await Promise.all([
    findUniqueContacts({ companyId, primaryKey }),
    readAllCompanyContacts({ companyId }),
  ]);

  const promises = [];

  let duplicatedCounts = [];

  for (const uc of allCompanyContacts) {
    const matchingUniqueContact = uniqueContacts.find(
      (cc) =>
        uc[primaryKey] === cc[primaryKey] &&
        uc._id.toString() !== cc._id.toString()
    );

    if (matchingUniqueContact) {
      const duplicates = allCompanyContacts.filter(
        (contact) =>
          contact[primaryKey] === uc[primaryKey] &&
          contact._id.toString() !== matchingUniqueContact._id.toString()
      );

      duplicates.sort((a, b) =>
        a._id.toString().localeCompare(b._id.toString())
      );

      const acceptedDuplicate = duplicates.shift();

      if (acceptedDuplicate) {
        promises.push(
          CompanyContact.updateOne(
            { _id: acceptedDuplicate._id },
            {
              $set: {
                public_circles_existing_contactId: matchingUniqueContact._id,
              },
            }
          )
        );
        duplicatedCounts.push(acceptedDuplicate._id);
      }

      for (const duplicate of duplicates) {
        promises.push(
          CompanyContact.updateOne(
            { _id: duplicate._id },
            {
              $set: {
                public_circles_existing_contactId: null,
                public_circles_status: "DELETE",
              },
            }
          )
        );
      }
    }
  }
  if(getCountsOnly) {
    duplicatedCounts =  _.uniq(duplicatedCounts).map((id) => id.toString());
    return duplicatedCounts.length;
  }
  else{
    await Promise.all(promises);
  }
};


const createPrimaryKey = async ({ companyId, primaryKey }) => {
  await Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: primaryKey,
  });

  await markContactsDuplicateWithPrimaryKey({ companyId, primaryKey });
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

  await markContactsDuplicateWithPrimaryKey({ companyId, primaryKey });
};

const deletePrimaryKey = async ({ companyId }) =>
  Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: null,
  });

const readCompanyContactsCount = ({ companyId }) =>
  CompanyContact.countDocuments({
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
  });

const readPrimaryKeyEffect = async ({ companyId, primaryKey }) => {
  const duplicateCount = await markContactsDuplicateWithPrimaryKey({ companyId, primaryKey, getCountsOnly: true });

  return `Based on your selection, there will be ${duplicateCount} contact${
    duplicateCount !== 1 ? "s" : ""
  } which you will have to review.`;
};

const deleteSelectedContacts = async ({ companyId, contactIds }) => {
  const result = await CompanyContact.updateMany(
    {
      _id: { $in: contactIds },
      public_circles_company: companyId,
    },
    {
      public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
      public_circles_existing_contactId: null,
    }
  );

  if (!result.modifiedCount) {
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
    public_circles_company: companyId,
    public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    $and: contactSelectionCriteria.map((filter) => ({
      [filter.filterKey]: { $in: filter.filterValues },
    })),
  };

  const [filteredContacts, totalContacts] = await Promise.all([
    CompanyContact.countDocuments(query),
    CompanyContact.countDocuments({
      public_circles_company: companyId,
      public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
    }),
  ]);

  return totalContacts - filteredContacts;
};

const filterContactsBySelectionCriteria = async ({ companyId, contactSelectionCriteria }) => {
  const query = {
    public_circles_company: companyId,
  };

  if (contactSelectionCriteria?.length > 0) {
    query.$and = contactSelectionCriteria.map((filter) => ({
      [filter.filterKey]: { $in: filter.filterValues },
    }));
  }

  const filteredContactIds = await CompanyContact.distinct("_id", query);

  await CompanyContact.updateMany(
    { _id: { $nin: filteredContactIds }, public_circles_company: companyId },
    { public_circles_status: COMPANY_CONTACT_STATUS.DELETED, public_circles_existing_contactId: null }
  );
};


const createMultipleCompanyContacts = ({ contacts }) => {
  CompanyContact.insertMany(contacts);
};

const filterInternalKeys = (obj) => {
  return Object.keys(obj).reduce((acc, key) => {
    // Allow "public_circles_company" and exclude other "public_circles_" keys
    if (
      key === "public_circles_company" ||
      (!key.startsWith("public_circles_") && key !== "__v")
    ) {
      acc[key] = obj[key];
    }

    return acc;
  }, {});
};

const readCompanyContactDuplicates = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const query = {
    public_circles_company: companyId,
    public_circles_status: { $ne: COMPANY_CONTACT_STATUS.DELETED },
    public_circles_existing_contactId: { $ne: null },
  };
  const totalDuplicatedContact = await CompanyContact.find(query);
  
  const duplicateContacts = await CompanyContact.find(query)
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(parseInt(pageSize));

  const promises = [];

  duplicateContacts.forEach((dc) => {
    promises.push(
      CompanyContact.findOne({
        public_circles_company: companyId,
        _id: dc["public_circles_existing_contactId"],
        public_circles_status: { $ne: COMPANY_CONTACT_STATUS.DELETED },
      })
    );
  });

  const results = await Promise.all(promises);

  const duplicates = [];

  results.forEach((result, index) => {
    if (result && duplicateContacts[index]) {
      duplicates.push({
        old: filterInternalKeys(result.toJSON()),
        new: filterInternalKeys(duplicateContacts[index].toJSON()),
      });
    }
  });

  return {
    totalRecords: totalDuplicatedContact.length,
    duplicateContacts: duplicates,
  };
};

const readDuplicateContactsCountByCompanyId = ({ companyId }) =>
  CompanyContact.countDocuments({
    public_circles_company: companyId,
    public_circles_existing_contactId: { $ne: null },
    public_circles_status: { $ne: COMPANY_CONTACT_STATUS.DELETED },
  });

const resolveCompanyContactDuplicates = async ({
  companyId,
  isSaveNewContact,
  contactsToBeSaved,
}) => {
  const companiesController = require("./companies.controller");

  const { contactsPrimaryKey } = await companiesController.readCompanyById({
    companyId,
  });

  const promises = [];

  if (contactsToBeSaved && contactsToBeSaved.length) {
    contactsToBeSaved.forEach((contact) => {
      promises.push(
        CompanyContact.updateMany(
          {
            public_circles_company: companyId,
            _id: { $ne: contact._id },
            [contactsPrimaryKey]: contact[contactsPrimaryKey],
          },
          {
            public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
            public_circles_existing_contactId: null,
          }
        )
      );
      contact.public_circles_existing_contactId = null;
      promises.push(
        CompanyContact.updateOne(
          {
            public_circles_company: companyId,
            _id: contact._id,
          },
          contact
        )
      );
    });

    await Promise.all(promises);
  } else {
    const query = {
      public_circles_company: companyId,
      public_circles_status: { $ne: COMPANY_CONTACT_STATUS.DELETED }
    };

    let duplicateContacts = [];

    const contactsToBeDeleted = [];

    if (isSaveNewContact) {
      await CompanyContact.find(query);
      duplicateContacts.forEach((dc) => {
        contactsToBeDeleted.push(dc["public_circles_existing_contactId"]);
      });
    } else {
      query.public_circles_existing_contactId = { $ne: null };
      duplicateContacts = await CompanyContact.find(query)
      duplicateContacts.forEach((dc) => {
        contactsToBeDeleted.push(dc._id);
      });
    }

    await CompanyContact.updateMany(
      {
        _id: { $in: contactsToBeDeleted },
      },
      {
        public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
        public_circles_existing_contactId: null,
      }
    );
    await CompanyContact.updateMany(
      {
        _id: { $nin: contactsToBeDeleted },
        public_circles_company: companyId,
      },
      {
        public_circles_existing_contactId: null,
      }
    );
  }
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
  getFilterConditionQuery,
  readCompanyContactDuplicates,
  readDuplicateContactsCountByCompanyId,
  resolveCompanyContactDuplicates,
};
