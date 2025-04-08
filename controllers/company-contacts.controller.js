const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const path = require("path");
const _ = require("lodash");
const { Worker } = require("worker_threads");

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
    CompanyContact.aggregate([
      {
        $match: {
          public_circles_company: companyId,
          public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
          [key]: { $nin: [null, undefined, ""] },
        },
      },
      {
        $group: {
          _id: `$${key}`,
        },
      },
      {
        $skip: (parseInt(pageNumber) - 1) * parseInt(pageSize),
      },
      {
        $limit: parseInt(pageSize),
      },
    ]),
    CompanyContact.aggregate([
      {
        $match: {
          public_circles_company: companyId,
          public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
          [key]: { $nin: [null, undefined ,""] },
        },
      },
      {
        $group: {
          _id: `$${key}`,
        },
      },
      {
        $count: "totalCount",
      },
    ]),
  ]);
  const total = totalResults.length > 0 ? totalResults[0].totalCount : 0;
  if (!company.contactsPrimaryKey) {
    throw createHttpError(403, {
      errorMessage: RESPONSE_MESSAGES.PRIMARY_KEY_NOT_FOUND,
    });
  }

  let uniqueValues = results.map((item) => item._id);

  // If total results are more than 500, sample 10% of the values
  if (uniqueValues.length > 500) {
    const sampleSize = Math.ceil(uniqueValues.length * 0.1); // Take 10% of the current page's values
    uniqueValues = getRandomSample(uniqueValues, sampleSize);
  }

  return { contactValues: uniqueValues, totalResults: total };
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
                      input: {
                        $trim: {
                          input: {
                            $toString: `$${conditionKey}`,
                          },
                        },
                      },
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
                      input: {
                        $trim: {
                          input: {
                            $toString: `$${conditionKey}`,
                          },
                        },
                      },
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
            $lt: [
              `$${conditionKey}`,
              { $dateFromString: { dateString: value } },
            ],
          },
        };

      case TIMESTAMP_AFTER:
        return {
          $expr: {
            $gt: [
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

  filters?.forEach((item) => {
    if (item.values && item.values.length && !item?.conditions?.length) {
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

  delete companyUserData.public_circles_company;
  delete companyUserData._id;

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

const updateCompanyContacts = async ({ filter, companyContactData }) => {
  await CompanyContact.updateMany(filter, {
    ...companyContactData,
  });
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
  const companyContactsCount = await readCompanyContactsCount({ companyId });
  if (!contactsPrimaryKey && companyContactsCount) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ADD_PRIMARY_KEY_FOR_NEXT_IMPORTS,
    });
  }

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

const markContactsDuplicateWithPrimaryKey = async ({
  companyId,
  primaryKey,
  getCountsOnly = false,
}) => {
  // Fetch all contacts
  const allCompanyContacts = await readAllCompanyContacts({ companyId });

  // Build a map for O(1) lookups by primaryKey
  const contactMap = new Map();
  for (const contact of allCompanyContacts) {
    const key = contact[primaryKey];
    if (!contactMap.has(key)) {
      contactMap.set(key, []);
    }
    contactMap.get(key).push(contact);
  }

  const updates = [];
  let duplicatedCounts = [];

  // Process each group of contacts with the same primaryKey
  for (const [key, contacts] of contactMap) {
    if (contacts.length <= 1) continue; // Skip if no duplicates

    // Sort by _id (assuming ObjectId; use timestamp for consistency)
    contacts.sort((a, b) => a._id.getTimestamp() - b._id.getTimestamp());
    const primaryContact = contacts.shift(); // First contact is "unique"

    // Process duplicates
    for (const duplicate of contacts) {
      if (!duplicatedCounts.length || duplicate === contacts[0]) {
        // First duplicate links to primary
        updates.push({
          updateOne: {
            filter: { _id: duplicate._id },
            update: {
              $set: {
                public_circles_existing_contactId: primaryContact._id,
              },
            },
          },
        });
        duplicatedCounts.push(duplicate._id);
      } else {
        // Remaining duplicates marked for deletion
        updates.push({
          updateOne: {
            filter: { _id: duplicate._id },
            update: {
              $set: {
                public_circles_existing_contactId: null,
                public_circles_status: "DELETE",
              },
            },
          },
        });
      }
    }
  }

  if (getCountsOnly) {
    return duplicatedCounts.length; // No need for _.uniq; _ids are unique
  } else {
    if (updates.length > 0) {
      await CompanyContact.bulkWrite(updates); // Batch updates
    }
  }
};

const updateMarkingDuplicatesStatus = async ({ companyId, status }) => {
  await Company.findByIdAndUpdate(companyId, { isMarkingDuplicates: status });
};

const initiateDuplicationMarkingInWorkerThread = ({
  companyId,
  currentUserId,
  primaryKey,
}) => {
  const workerPath = path.resolve(
    __dirname,
    "../threads/mark-duplicates.thread.js"
  );

  const worker = new Worker(workerPath);

  const { emitMessage, getSocket } = require("../socket");

  worker.on("message", (message) => {
    const targetSocket = getSocket({ userId: currentUserId });

    console.log(message);

    emitMessage({
      socketObj: targetSocket,
      socketChannel: SOCKET_CHANNELS.CONTACTS_MARK_DUPLICATE_PROGRESS,
      message,
    });
  });

  worker.on("error", (error) => {
    updateMarkingDuplicatesStatus({ companyId, status: false });

    emitMessage({
      socketObj: targetSocket,
      socketChannel: SOCKET_CHANNELS.CONTACTS_MARK_DUPLICATE_PROGRESS,
      message: error,
    });

    console.error("Worker error:", error);
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });

  worker.postMessage({
    companyId: companyId.toString(),
    primaryKey,
  });
};

const createPrimaryKey = async ({ companyId, currentUserId, primaryKey }) => {
  await Company.findByIdAndUpdate(companyId, {
    contactsPrimaryKey: primaryKey,
  });

  initiateDuplicationMarkingInWorkerThread({
    companyId,
    currentUserId,
    primaryKey,
  });
};

const readPrimaryKey = async ({ companyId }) => {
  const companyDoc = await Company.findById(companyId).select(
    "contactsPrimaryKey"
  );

  return companyDoc.contactsPrimaryKey;
};

const updatePrimaryKey = async ({ companyId, currentUserId, primaryKey }) => {
  await Promise.all([
    Company.findByIdAndUpdate(companyId, {
      contactsPrimaryKey: primaryKey,
    }),
    updateCompanyContacts({
      filter: {
        public_circles_company: companyId,
        public_circles_existing_contactId: {
          $exists: true,
        },
      },
      companyContactData: {
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      },
    }),
  ]);

  initiateDuplicationMarkingInWorkerThread({
    companyId,
    currentUserId,
    primaryKey,
  });
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
  const duplicateCount = await markContactsDuplicateWithPrimaryKey({
    companyId,
    primaryKey,
    getCountsOnly: true,
  });

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

const filterContactsBySelectionCriteria = async ({
  companyId,
  contactSelectionCriteria,
}) => {
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
    {
      public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
      public_circles_existing_contactId: null,
    }
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

  const baseQuery = {
    public_circles_company: companyId,
    public_circles_status: { $ne: COMPANY_CONTACT_STATUS.DELETED },
  };

  // Handle bulk contact updates
  if (contactsToBeSaved?.length) {
    const bulkOps = [];

    for (const contact of contactsToBeSaved) {
      // Delete duplicates
      bulkOps.push({
        updateMany: {
          filter: {
            public_circles_company: companyId,
            _id: { $ne: contact._id },
            [contactsPrimaryKey]: contact[contactsPrimaryKey],
          },
          update: {
            $set: {
              public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
              public_circles_existing_contactId: null,
            },
          },
        },
      });

      // Update current contact
      contact.public_circles_existing_contactId = null;
      bulkOps.push({
        updateOne: {
          filter: {
            public_circles_company: companyId,
            _id: contact._id,
          },
          update: { $set: contact },
        },
      });
    }

    await CompanyContact.bulkWrite(bulkOps);
  } else {
    // Handle single contact case
    const query = { ...baseQuery };
    if (!isSaveNewContact) {
      query.public_circles_existing_contactId = { $ne: null };
    }

    const duplicateContacts = await CompanyContact.find(query)
      .select("_id public_circles_existing_contactId")
      .lean();

    const contactsToBeDeleted = duplicateContacts
      .map((dc) =>
        isSaveNewContact ? dc.public_circles_existing_contactId : dc._id
      )
      .filter((id) => id);

    // Execute both updates in parallel
    await Promise.all([
      contactsToBeDeleted.length &&
        CompanyContact.updateMany(
          { _id: { $in: contactsToBeDeleted } },
          {
            $set: {
              public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
              public_circles_existing_contactId: null,
            },
          }
        ),
      CompanyContact.updateMany(
        {
          _id: { $nin: contactsToBeDeleted },
          public_circles_company: companyId,
        },
        { $set: { public_circles_existing_contactId: null } }
      ),
    ]);
  }
};

const finalizeCompanyContact = async ({ companyId }) => {
  const contactController = require("./company-contacts.controller");
  const stripeController = require("./stripe.controller");
  const companiesController = require("./companies.controller");

  const { totalRecords } =
    await contactController.readCompanyContactDuplicates({companyId});

  if (totalRecords) {
    throw createHttpError(400, {
      errorMessage:
        RESPONSE_MESSAGES.PLEASE_RESOLVE_DUPLICATES_BEFORE_FINALIZING,
    });
  }
  const companyDoc = await companiesController.readCompanyById({ companyId });
  if(!companyDoc.contactsPrimaryKey || !companyDoc.contactsPrimaryKey === ""){
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ADD_PRIMARY_KEY_FOR_FINALIZATION_IMPORTS,
    });
  }

  const companyExistingContacts =
    await contactController.readCompanyContactsCount({ companyId });

  await stripeController.calculateAndChargeContactOverage({
    companyId,
    stripeCustomerId: companyDoc.stripeCustomerId,
    importedContactsCount: 0,
    existingContactsCount: companyExistingContacts,
  });

  await Company.updateOne({ _id: companyId }, { isContactFinalize: true });
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
  updateCompanyContacts,
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
  markContactsDuplicateWithPrimaryKey,
  updateMarkingDuplicatesStatus,
  finalizeCompanyContact
};
