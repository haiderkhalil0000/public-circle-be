const mongoose = require("mongoose");
const createError = require("http-errors");

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
    throw createError(400, {
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

const readTemplate = async ({ templateId = "" }) => {
  if (templateId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_TEMPLATE_ID,
    });
  }

  templateId = new mongoose.Types.ObjectId(templateId);

  const template = await Template.findById(templateId);

  if (!template) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  return template;
};

const readAllTemplates = async ({
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

const updateTemplate = async ({ templateId = "", templateData }) => {
  if (templateId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_TEMPLATE_ID,
    });
  }

  templateId = new mongoose.Types.ObjectId(templateId);

  const result = await Template.updateOne(
    { _id: templateId },
    { ...templateData }
  );

  if (!result.matchedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
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
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createTemplate,
  readTemplate,
  readAllTemplates,
  updateTemplate,
  deleteTemplate,
};
