const createHttpError = require("http-errors");
const { CompanyGrouping, Campaign, Template } = require("../models");
const {
  RESPONSE_MESSAGES,
  COMPANY_GROUPING_TYPES,
  CAMPAIGN_STATUS,
  TEMPLATE_STATUS,
} = require("../utils/constants.util");
const { basicUtil } = require("../utils");

const createCompanyGrouping = async ({ companyId, type, groupName }) => {
  const existingCompanyGrouping = await CompanyGrouping.findOne({
    companyId,
    type,
    groupName,
  });
  if (existingCompanyGrouping) {
    throw createHttpError(400, RESPONSE_MESSAGES.COMPANY_GROUP_ALREADY_EXISTS);
  }
  return await CompanyGrouping.create({
    companyId,
    type,
    groupName,
  });
};

const getCompanyGroupingByType = async ({ companyId, type }) => {
  const filter = { companyId };
  if (type) filter.type = type;

  const companyGrouping = await CompanyGrouping.find(filter);

  if (!companyGrouping.length) {
    throw createHttpError(404, RESPONSE_MESSAGES.COMPANY_GROUPING_NOT_FOUND);
  }

  if (
    type === COMPANY_GROUPING_TYPES.TEMPLATE ||
    type === COMPANY_GROUPING_TYPES.CAMPAIGN
  ) {
    const groupingIds = companyGrouping.map((g) => g._id);

    let Model;
    if (type === COMPANY_GROUPING_TYPES.TEMPLATE) {
      Model = Template;
    } else if (type === COMPANY_GROUPING_TYPES.CAMPAIGN) {
      Model = Campaign;
    }

    const contentCounts = await Model.aggregate([
      { $match: { companyGroupingId: { $in: groupingIds } } },
      { $group: { _id: "$companyGroupingId", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    contentCounts.forEach((entry) => {
      countMap[entry._id.toString()] = entry.count;
    });

    return companyGrouping.map((group) => ({
      ...group.toObject(),
      contentCount: countMap[group._id.toString()] || 0,
    }));
  }
  return companyGrouping;
};

const patchCompanyGroupingById = async ({ id, type, groupName }) => {
  basicUtil.validateObjectId({ inputString: id });
  const existingCompanyGrouping = await CompanyGrouping.findOne({
    groupName,
    type,
  });
  if (existingCompanyGrouping) {
    throw createHttpError(400, RESPONSE_MESSAGES.COMPANY_GROUP_ALREADY_EXISTS);
  }
  return await CompanyGrouping.findOneAndUpdate(
    { _id: id },
    { type, groupName },
    { new: true }
  );
};

const deleteCompanyGroupingById = async ({ id }) => {
  basicUtil.validateObjectId({ inputString: id });

  const [campaignExists, templateExists] = await Promise.all([
    Campaign.exists({ companyGroupingId: id, status: CAMPAIGN_STATUS.DELETED }),
    Template.exists({ companyGroupingId: id, status: TEMPLATE_STATUS.DELETED }),
  ]);

  if (campaignExists) {
    throw createHttpError(
      400,
      RESPONSE_MESSAGES.COMPANY_GROUPING_IS_USED_IN_CAMPAIGN
    );
  }

  if (templateExists) {
    throw createHttpError(
      400,
      RESPONSE_MESSAGES.COMPANY_GROUPING_IS_USED_IN_TEMPLATE
    );
  }

  return CompanyGrouping.findOneAndDelete({ _id: id });
};

const getCompanyGroupingById = async ({ id }) => {
  basicUtil.validateObjectId({ inputString: id });
  return await CompanyGrouping.findOne({ _id: id });
};

module.exports = {
  createCompanyGrouping,
  getCompanyGroupingByType,
  patchCompanyGroupingById,
  deleteCompanyGroupingById,
  getCompanyGroupingById,
};
