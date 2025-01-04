const express = require("express");
const templateCategoryDebugger = require("debug")("debug:template-category");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { templateCategoriesController } = require("../controllers");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");

const router = express.Router();

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const allTemplateCategories =
      await templateCategoriesController.readAllTemplateCategories();

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ALL_TEMPLATE_CATEGORIES,
      data: allTemplateCategories,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    templateCategoryDebugger(err);

    next(err);
  }
});

router.get(
  "/:templateCategoryId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      templateCategoryId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const templateCategory =
        await templateCategoriesController.readTemplateCategory(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_TEMPLATE_CATEGORY,
        data: templateCategory,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      templateCategoryDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const templateCategories =
        await templateCategoriesController.readPaginatedTemplateCategories(
          req.query
        );

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_TEMPLATES,
        data: templateCategories,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      templateCategoryDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
