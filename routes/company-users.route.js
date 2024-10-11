const express = require("express");
const Joi = require("joi");
const companyUsersDebugger = require("debug")("debug:users-data-set");

const { authenticate, validate } = require("../middlewares");
const { RESPONSE_MESSAGES } = require("../utils/constants.util");
const { companyUsersController } = require("../controllers");

const router = express.Router();

Joi.objectId = require("joi-objectid")(Joi);

router.get(
  "/possible-filter-keys",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const possibleFilterKeys =
        await companyUsersController.getPossibleFilterKeys({
          companyId: req.user.company._id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_FILTER_KEYS,
        data: possibleFilterKeys,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/possible-filter-values",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      key: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const possibleFilterValues =
        await companyUsersController.getPossibleFilterValues({
          companyId: req.user.company._id,
          key: req.query.key,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_POSSIBLE_VALUES,
        data: possibleFilterValues,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/get-filter-count",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      filters: Joi.object().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const filterCount = await companyUsersController.getFiltersCount(
        req.body
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_FILTER_COUNT,
        data: filterCount,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/search",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      searchString: Joi.string().required(),
      searchFields: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const autoCompleteData = await companyUsersController.search({
        companyId: req.user.company._id,
        searchString: req.body.searchString,
        searchFields: req.body.searchFields,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.SEARCH_SUCCESSFUL,
        data: autoCompleteData,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/interact",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      filters: Joi.object().required(),
      channel: Joi.string().required(),
      format: Joi.object().required(),
      sourceEmailAddress: Joi.string().email().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyUsersController.interactWithUsers({
        filters: req.body.filters,
        channel: req.body.channel,
        companyId: req.user.company._id,
        format: req.body.format,
        sourceEmailAddress: req.body.sourceEmailAddress,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.INTERACTION_SUCCESSFULL,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/all",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyUsers = await companyUsersController.readAllCompanyUsers({
        companyId: req.user.company._id,
        pageNumber: req.query.pageNumber,
        pageSize: req.query.pageSize,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_CompanyUserS,
        data: companyUsers,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
