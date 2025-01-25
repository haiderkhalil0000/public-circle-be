const express = require("express");
const Joi = require("joi");
const filterDebugger = require("debug")("debug:filter");

const { authenticate, validate } = require("../middlewares");
const {
  constants: { RESPONSE_MESSAGES, FILTER_TYPES },
} = require("../utils");
const { filtersController } = require("../controllers");

const router = express.Router();

Joi.objectId = require("joi-objectid")(Joi);

router.get(
  "/possible-filter-keys/:companyId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      companyId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const possibleFilterKeys = await filtersController.readPossibleFilterKeys(
        req.params
      );

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
      companyId: Joi.string().required(),
      key: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const possibleFilterValues =
        await filtersController.readPossibleFilterValues(req.query);

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
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      filterLabel: Joi.string().required(),
      filterType: Joi.string()
        .valid(
          FILTER_TYPES.INPUT,
          FILTER_TYPES.DROP_DOWN,
          FILTER_TYPES.RADIO,
          FILTER_TYPES.CHECK_BOX,
          FILTER_TYPES.RANGE_SLIDER
        )
        .required(),
      filterKey: Joi.string().required(),
      filterValues: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await filtersController.createFilter(req.body, {
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FILTER_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      filterDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:filterId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      filterId: Joi.string().required(),
    }),
    body: Joi.object({
      filterLabel: Joi.string().required(),
      filterType: Joi.string()
        .valid(
          FILTER_TYPES.INPUT,
          FILTER_TYPES.DROP_DOWN,
          FILTER_TYPES.RADIO,
          FILTER_TYPES.CHECK_BOX,
          FILTER_TYPES.RANGE_SLIDER
        )
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await filtersController.updateFilter(req.params, req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FILTER_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      filterDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const filters = await filtersController.readAllFilters({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_FILTERS_FETCHED,
      data: filters,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    filterDebugger(err);

    next(err);
  }
});

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
      const filters = await filtersController.readPaginatedFilters({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FILTER_FETCHEDS,
        data: filters,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      filterDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/:filterId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      filterId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const filter = await filtersController.readFilter(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FILTER_FETCHED,
        data: filter,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      filterDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:filterId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      filterId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await filtersController.deleteFilter(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.FILTER_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      filterDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
