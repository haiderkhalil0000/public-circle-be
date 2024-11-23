const createHttpError = require("http-errors");

const { Template } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, TEMPLATE_KINDS, TEMPLATE_STATUS },
} = require("../utils");

const createTemplate = async ({ companyId, name, kind, body, json }) => {
  const existingTemplate = await Template.findOne({
    name,
    company: companyId,
  });

  if (existingTemplate) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_TEMPLATE,
    });
  }

  const document = {
    name,
    kind,
    body,
    json,
  };

  if (kind === TEMPLATE_KINDS.REGULAR) {
    document.company = companyId;
  }

  return Template.create(document);
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

const readAllTemplates = async ({ companyId, kind }) => {
  const query = { status: TEMPLATE_STATUS.ACTIVE };

  if (kind === TEMPLATE_KINDS.REGULAR) {
    query.company = companyId;
    query.kind = TEMPLATE_KINDS.REGULAR;
  } else {
    query.kind = TEMPLATE_KINDS.SAMPLE;
  }

  return Template.find(query);
};

const readPaginatedTemplates = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
  kind,
}) => {
  const query = { status: TEMPLATE_STATUS.ACTIVE };

  if (kind === TEMPLATE_KINDS.REGULAR) {
    query.company = companyId;
    query.kind = TEMPLATE_KINDS.REGULAR;
  } else {
    query.kind = TEMPLATE_KINDS.SAMPLE;
  }

  const [totalRecords, templates] = await Promise.all([
    Template.countDocuments(query),
    Template.find(query)
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
};

const deleteTemplate = async ({ templateId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const result = await Template.updateOne(
    { _id: templateId },
    {
      status: TEMPLATE_STATUS.DELETED,
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
