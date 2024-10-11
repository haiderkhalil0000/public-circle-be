const mongoose = require("mongoose");
const _ = require("lodash");
const createError = require("http-errors");

const { CompanyUser, Configuration, EmailStats } = require("../models");
const {
  constants: { INTERACTION_CHANNELS },
} = require("../utils");
const { sendEmail } = require("../utils/ses.util");
const {
  DOCUMENT_STATUS,
  RESPONSE_MESSAGES,
} = require("../utils/constants.util");

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

  return allKeys.filter((item) => item !== "_id" && item !== "__v");
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

const validateConfiguration = ({ configuration }) => {
  let errorMessage = "";

  if (!configuration.length) {
    errorMessage = RESPONSE_MESSAGES.CONFIGURATION_NOT_FOUND;
  } else if (!configuration[0].matchedAddress.isVerified) {
    errorMessage = RESPONSE_MESSAGES.EMAIL_NOT_VERIFIED;
  } else if (
    configuration[0].matchedAddress.status !== DOCUMENT_STATUS.ACTIVE
  ) {
    errorMessage = RESPONSE_MESSAGES.INVALID_EMAIL;
  }

  if (errorMessage) {
    throw createError(400, { errorMessage });
  }
};

const mapDynamicValues = async ({ companyId, emailAddress, content }) => {
  const companyData = await CompanyUser.findOne({
    companyId,
    email: emailAddress,
  }).lean();

  if (!companyData) {
    throw createError(400, { errorMessage });
  }

  // Iterate over the user's keys and replace placeholders dynamically
  let modifiedContent = content;

  for (const [key, value] of Object.entries(companyData)) {
    const placeholder = `#${key}`;
    // Replace all occurrences of the placeholder with the actual value
    modifiedContent = modifiedContent.replace(
      new RegExp(placeholder, "g"),
      value
    );
  }

  return modifiedContent;
};

const interactWithUsers = async ({
  filters,
  channel,
  companyId,
  format,
  sourceEmailAddress,
}) => {
  if (channel === INTERACTION_CHANNELS.EMAIL) {
    let query = { companyId };

    for (let key in filters) {
      if (Array.isArray(filters[key])) {
        query[key] = { $in: filters[key] };
      } else {
        query[key] = filters[key];
      }
    }

    const [configuration, emailAddressObjects] = await Promise.all([
      Configuration.aggregate([
        {
          $match: {
            "emailConfigurations.addresses.emailAddress": sourceEmailAddress,
          },
        },
        {
          $project: {
            _id: 0,
            matchedAddress: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$emailConfigurations.addresses",
                    as: "address",
                    cond: {
                      $eq: ["$$address.emailAddress", sourceEmailAddress],
                    },
                  },
                },
                0, // Return the first matched element
              ],
            },
          },
        },
      ]),
      CompanyUser.find(query, {
        email: 1,
      }),
    ]);

    validateConfiguration({ configuration });

    const emailAddresses = emailAddressObjects.map((item) => item.email);

    const promises = [];

    for (const emailAddress of emailAddresses) {
      promises.push(
        mapDynamicValues({
          companyId,
          emailAddress,
          content: format.content,
        })
      );
    }

    const mappedContentArray = await Promise.all(promises);

    promises.length = 0;

    for (let index = 0; index < mappedContentArray.length; index++) {
      promises.push(
        sendEmail({
          fromEmailAddress: sourceEmailAddress,
          toEmailAddress: emailAddresses[index],
          subject: format.subject,
          content: mappedContentArray[index],
        })
      );

      promises.push(
        EmailStats.create({
          companyId,
          fromEmailAddress: sourceEmailAddress,
          toEmailAddress: emailAddresses[index],
          emailSubject: format.subject,
          emailContent: mappedContentArray[index],
        })
      );
    }

    await Promise.all(promises);
  }
};

const readAllCompanyUsers = ({ companyId, pageNumber = 1, pageSize = 10 }) =>
  CompanyUser.find({ companyId })
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(pageSize);

module.exports = {
  getPossibleFilterKeys,
  getPossibleFilterValues,
  getFiltersCount,
  interactWithUsers,
  search,
  readAllCompanyUsers,
};
