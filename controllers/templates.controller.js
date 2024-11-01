const mongoose = require("mongoose");
const createHttpError = require("http-errors");

const { Template } = require("../models");
const {
  RESPONSE_MESSAGES,
  DOCUMENT_STATUS,
} = require("../utils/constants.util");

const createTemplate = async ({ companyId, name, kind, body }) => {
  const existingTemplate = await Template.findOne({
    name,
    companyId,
  });

  if (existingTemplate) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_TEMPLATE,
    });
  }

  Template.create({
    companyId,
    name,
    kind,
    body,
  });
};

const readTemplate = async ({ templateId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const template = await Template.findById(templateId);

  if (!template) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  return template;
};

const readAllTemplates = async ({ companyId }) =>
  Template.find({
    companyId,
    status: DOCUMENT_STATUS.ACTIVE,
  });

const readPaginatedTemplates = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, templates] = await Promise.all([
    Template.countDocuments({ companyId, status: DOCUMENT_STATUS.ACTIVE }),
    Template.find({
      companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return { totalRecords, templates };
};

const updateTemplate = async ({ templateId, templateData }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const result = await Template.updateOne(
    { _id: templateId },
    { ...templateData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_UPDATED_ALREADY,
    });
  }
};

const deleteTemplate = async ({ templateId = "" }) => {
  templateId = new mongoose.Types.ObjectId(templateId);

  const result = await Template.updateOne(
    { _id: templateId },
    {
      status: DOCUMENT_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createTemplate,
  readTemplate,
  readPaginatedTemplates,
  readAllTemplates,
  updateTemplate,
  deleteTemplate,
};
