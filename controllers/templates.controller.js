const createHttpError = require("http-errors");
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");

const { Template } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, TEMPLATE_KINDS, TEMPLATE_STATUS },
  s3Util,
} = require("../utils");

const createThumbnail = async ({ html, width, height }) => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--disable-web-security"],
  });

  const page = await browser.newPage();

  await page.setContent(html, {
    waitUntil: "load",
  });

  // Set the viewport size to the desired thumbnail dimensions
  await page.setViewport({
    width: width * 2, // Use a higher resolution for better quality
    height: height * 2,
  });

  // Take a screenshot
  const screenshotBuffer = await page.screenshot({ type: "png" });

  // Resize the screenshot to the desired thumbnail size
  const resizedBuffer = await sharp(screenshotBuffer)
    .resize(width, height)
    .toBuffer();

  await browser.close();

  console.log(`Thumbnail created`);

  return resizedBuffer;
};

const createTemplate = async ({ companyId, name, kind, body, json }) => {
  const existingTemplate = await Template.findOne({
    name,
    company: companyId,
    status: TEMPLATE_STATUS.ACTIVE,
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

  const buffer = await createThumbnail({
    html: body,
    width: 200,
    height: 150,
  });

  const url = await s3Util.uploadTemplateThumbnail({
    s3Path: `/thumbnails/${companyId}/${document.name}.png`,
    buffer,
  });

  document.thumbnailURL = url;

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

  const allTemplates = await Template.find(query).lean();

  allTemplates.forEach((item) => {
    if (item.body.includes("unsubscribe")) {
      item.isUnSubPresent = true;
    } else {
      item.isUnSubPresent = false;
    }
  });

  return allTemplates;
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
