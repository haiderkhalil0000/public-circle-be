const createHttpError = require("http-errors");
const puppeteer = require("puppeteer-core");

const { Template, User, CompanyGrouping } = require("../models");
const {
  basicUtil,
  constants: { RESPONSE_MESSAGES, TEMPLATE_KINDS, TEMPLATE_STATUS, COMPANY_GROUPING_TYPES },
  s3Util,
} = require("../utils");

const mongoose = require("mongoose");

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
  // await page.setViewport({
  //   width: width * 2, // Use a higher resolution for better quality
  //   height: height * 2,
  // });

  // Take a screenshot
  const screenshotBuffer = await page.screenshot({ type: "png" });

  // // Resize the screenshot to the desired thumbnail size
  // const resizedBuffer = await sharp(screenshotBuffer)
  //   .resize(width, height)
  //   .toBuffer();

  await browser.close();

  return screenshotBuffer;
};

const duplicateExistingTemplate = async ({
  templateId,
  companyId,
}) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const originalTemplate = await Template.findOne({
    _id: templateId,
    company: companyId,
    status: TEMPLATE_STATUS.ACTIVE,
  });

  if (!originalTemplate) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ORIGINAL_TEMPLATE_ID_NOT_FOUND,
    });
  }

  const currentDuplicatedCount = await Template.countDocuments({
    existingTemplateId: originalTemplate._id,
    status: TEMPLATE_STATUS.ACTIVE,
  });

  const document = {
    name: `${originalTemplate.name}-${currentDuplicatedCount + 1}`,
    kind: originalTemplate.kind,
    body: originalTemplate.body,
    size: Buffer.byteLength(originalTemplate.body, "utf-8"),
    jsonTemplate: originalTemplate.jsonTemplate,
    existingTemplateId: originalTemplate._id,
    companyGroupingId: originalTemplate?.companyGroupingId,
    isDuplicate: true,
  };

  if (originalTemplate.kind === TEMPLATE_KINDS.REGULAR) {
    document.company = companyId;
  }

  const buffer = await createThumbnail({
    html: originalTemplate.body,
    width: 150,
    height: 150,
  });

  const url = await s3Util.uploadImageToS3({
    s3Path: `thumbnails/${companyId}/${templateId}/${document.name}.png`,
    buffer,
  });

  document.thumbnailURL = url;
  await Template.create(document);
};

const duplicateTemplate = async ({
  companyId,
  emailAddress,
  existingTemplateId,
  name,
  kind,
  body,
  jsonTemplate,
  companyGroupingId,
}) => {
  basicUtil.validateObjectId({ inputString: existingTemplateId });

  const originalTemplate = await Template.findOne({
    _id: existingTemplateId,
    company: companyId,
    status: TEMPLATE_STATUS.ACTIVE,
  });

  if (!originalTemplate) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ORIGINAL_TEMPLATE_ID_NOT_FOUND,
    });
  }

  const document = {
    name,
    kind,
    body,
    size: Buffer.byteLength(body, "utf-8"),
    jsonTemplate,
    existingTemplateId,
    companyGroupingId,
    isDuplicate: true,
  };

  if (kind === TEMPLATE_KINDS.REGULAR) {
    document.company = companyId;
  }

  const buffer = await createThumbnail({
    html: body,
    width: 150,
    height: 150,
  });

  const url = await s3Util.uploadImageToS3({
    s3Path: `thumbnails/${companyId}/${existingTemplateId}/${document.name}.png`,
    buffer,
  });

  document.thumbnailURL = url;
  await Template.create(document);
  await User.findOneAndUpdate(
    { emailAddress },
    {
      $set: {
        "tourSteps.steps.4.isCompleted": true,
      },
    }
  );
};

const createTemplate = async ({
  companyId,
  emailAddress,
  name,
  kind,
  body,
  jsonTemplate,
  companyGroupingId,
}) => {
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
  basicUtil.validateObjectId({ inputString: companyGroupingId });
  const companyGrouping = await CompanyGrouping.findOne({
    _id: companyGroupingId,
    companyId,
    type: COMPANY_GROUPING_TYPES.TEMPLATE,
  });

  if (!companyGrouping) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.COMPANY_GROUPING_NOT_FOUND,
    });
  }
    

  const document = {
    name,
    kind,
    body,
    size: Buffer.byteLength(body, "utf-8"),
    jsonTemplate,
    companyGroupingId,
  };

  if (kind === TEMPLATE_KINDS.REGULAR) {
    document.company = companyId;
  }

  const buffer = await createThumbnail({
    html: body,
    width: 150,
    height: 150,
  });

  const url = await s3Util.uploadImageToS3({
    s3Path: `thumbnails/${companyId}/${document.name}.png`,
    buffer,
  });

  document.thumbnailURL = url;
  await Template.create(document);
  await User.findOneAndUpdate(
    { emailAddress },
    {
      $set: {
        "tourSteps.steps.4.isCompleted": true,
      },
    }
  );
};

const readTemplate = async ({ templateId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  const template = await Template.findById(templateId).populate('companyGroupingId').lean();

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

  // allTemplates.forEach((item) => {
  //   if (
  //     item.body.includes("unsubscribe") ||
  //     item.body.includes("Unsubscribe") ||
  //     item.body.includes("UnSubscribe")
  //   ) {
  //     item.isUnSubPresent = true;
  //   } else {
  //     item.isUnSubPresent = false;
  //   }
  // });

  return allTemplates;
};

const readPaginatedTemplates = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
  kind,
  companyGroupingIds,
}) => {
  const query = {
    status: TEMPLATE_STATUS.ACTIVE,
  };

  if (companyGroupingIds) {
    const idsArray = companyGroupingIds.split(",").map((id) => {
      basicUtil.validateObjectId({ inputString: id });
      return new mongoose.Types.ObjectId(id);
    });
    query.companyGroupingId = { $in: idsArray };
  }

  if (kind === TEMPLATE_KINDS.REGULAR) {
    query.company = new mongoose.Types.ObjectId(companyId);
    query.kind = TEMPLATE_KINDS.REGULAR;
  } else {
    query.kind = TEMPLATE_KINDS.SAMPLE;
  }
  const skip = (parseInt(pageNumber) - 1) * pageSize;

  const [totalRecords, templates] = await Promise.all([
    Template.countDocuments(query),
    Template.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'updatedBy',
          foreignField: '_id',
          as: 'updatedBy',
        },
      },
      {
        $unwind: {
          path: '$updatedBy',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          let: { templateId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$emailTemplate', '$$templateId'] },
                    { $ne: ['$status', 'DELETED'] },
                  ],
                },
              },
            },
            {
              $project: {
                campaignName: 1,
                _id: 1,
              },
            },
          ],
          as: 'campaigns',
        },
      },
      {
        $lookup: {
          from: 'company-groupings',
          localField: 'companyGroupingId',
          foreignField: '_id',
          as: 'companyGrouping',
        },
      },
      {
        $unwind: {
          path: '$companyGrouping',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: 1,
          kind: 1,
          status: 1,
          thumbnailURL: 1,
          size: 1,
          body: 1,
          jsonTemplate: 1,
          sizeUnit: 1,
          company: 1,
          createdAt: 1,
          updatedAt: 1,
          updatedBy: {
            firstName: 1,
            lastName: 1,
          },
          campaigns: 1,
          companyGrouping: 1,
        },
      },
      { $skip: skip },
      { $limit: parseInt(pageSize) },
    ]),
  ]);

  return { totalRecords, templates };
};

const updateTemplate = async ({ templateId, templateData, companyId, userId }) => {
  basicUtil.validateObjectId({ inputString: templateId });

  if(templateData.companyGroupingId) {
    basicUtil.validateObjectId({ inputString: templateData.companyGroupingId });
    const companyGrouping = await CompanyGrouping.findOne({
      _id: templateData.companyGroupingId,
      companyId,
      type: COMPANY_GROUPING_TYPES.TEMPLATE,
    });
    if (!companyGrouping) {
      throw createHttpError(400, {
        errorMessage: RESPONSE_MESSAGES.COMPANY_GROUPING_NOT_FOUND,
      });
    }
  }

  if (templateData.body) {
    const [buffer, template] = await Promise.all([
      createThumbnail({
        html: templateData.body,
        width: 150,
        height: 150,
      }),
      Template.findById(templateId),
    ]);

    const url = await s3Util.uploadImageToS3({
      s3Path: `thumbnails/${companyId}/${template.name}.png`,
      buffer,
    });

    templateData.thumbnailURL = url;
    templateData.size = Buffer.byteLength(templateData.body, "utf-8");
    templateData.updatedBy = userId;
  }

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
  const templateIdUsedIn = await Template.find({
    existingTemplateId: templateId,
    status: TEMPLATE_STATUS.ACTIVE,
  });

  if (templateIdUsedIn.length) {
    await Template.updateMany(
      { existingTemplateId: templateId },
      {
        existingTemplateId: null,
      }
    );
  }

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

const searchTemplate = async ({ searchString }) => {
  const templateCategoriesController = require("./template-categories.controller");

  let [templates, templateCategoryIds] = await Promise.all([
    Template.find({
      name: new RegExp(searchString, "i"),
      kind: TEMPLATE_KINDS.SAMPLE,
    }),
    templateCategoriesController.searchTemplateCategoryIds({ searchString }),
  ]);

  const categoryTemplates = await Template.find({
    category: { $in: templateCategoryIds },
    kind: TEMPLATE_KINDS.SAMPLE,
  });

  return [...templates, ...categoryTemplates];
};

module.exports = {
  createTemplate,
  readTemplate,
  readPaginatedTemplates,
  readAllTemplates,
  updateTemplate,
  deleteTemplate,
  searchTemplate,
  duplicateExistingTemplate,
  duplicateTemplate,
};
