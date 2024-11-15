const createHttpError = require("http-errors");

const { DynamicTemplate } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, DOCUMENT_STATUS },
} = require("../utils");

const createTemplate = async ({
  companyId,
  name,
  kind,
  body,
  staticTemplateId,
}) => {
  basicUtil.validateObjectId({ inputString: staticTemplateId });

  const existingTemplate = await DynamicTemplate.findOne({
    name,
    company: companyId,
  });

  if (existingTemplate) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_TEMPLATE,
    });
  }

  DynamicTemplate.create({
    companyId,
    name,
    kind,
    body,
    staticTemplate: staticTemplateId,
  });
};

const readTemplate = async ({ templateId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const template = await DynamicTemplate.findById(templateId);

  if (!template) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }

  return template;
};

const readAllTemplates = async ({ companyId }) =>
  DynamicTemplate.find({
    company: companyId,
    status: DOCUMENT_STATUS.ACTIVE,
  });

const readPaginatedTemplates = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, templates] = await Promise.all([
    DynamicTemplate.countDocuments({
      company: companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    }),
    DynamicTemplate.find({
      company: companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return { totalRecords, templates };
};

const updateTemplate = async ({ templateId, templateData }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const result = await DynamicTemplate.updateOne(
    { _id: templateId },
    { ...templateData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.TEMPLATE_NOT_FOUND,
    });
  }
};

const deleteTemplate = async ({ templateId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const result = await DynamicTemplate.updateOne(
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
};

module.exports = {
  createTemplate,
  readTemplate,
  readPaginatedTemplates,
  readAllTemplates,
  updateTemplate,
  deleteTemplate,
};
