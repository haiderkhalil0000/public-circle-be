const express = require("express");
const Joi = require("joi");
const companyUsersDebugger = require("debug")("debug:company-users");

const { upload } = require("../startup/multer.config");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { authenticate, validate } = require("../middlewares");
const { companyUsersController } = require("../controllers");

const router = express.Router();

Joi.objectId = require("joi-objectid")(Joi);

router.get("/primary-key", authenticate.verifyToken, async (req, res, next) => {
  try {
    const primaryKey = await companyUsersController.readPrimaryKey({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.PRIMARY_KEY_FETCHED,
      data: primaryKey,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyUsersDebugger(err);

    next(err);
  }
});

router.post(
  "/primary-key",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      primaryKey: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyUsersController.createPrimaryKey({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/primary-key",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      primaryKey: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyUsersController.updatePrimaryKey({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/primary-key",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await companyUsersController.deletePrimaryKey({
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_DELETED,
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
      const filterCount = await companyUsersController.getFiltersCount({
        ...req.body,
        companyId: req.user.company._id,
      });

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

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const companyUsers = await companyUsersController.readAllCompanyUsers({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ALL_COMPANY_USERS,
      data: companyUsers,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyUsersDebugger(err);

    next(err);
  }
});

router.get(
  "/",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyUsers =
        await companyUsersController.readPaginatedCompanyUsers({
          companyId: req.user.company._id,
          pageNumber: req.query.pageNumber,
          pageSize: req.query.pageSize,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_FETCHEDS,
        data: companyUsers,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/upload-csv",
  authenticate.verifyToken,
  upload.single("csvFile"),
  async (req, res, next) => {
    try {
      await companyUsersController.uploadCsv({
        companyId: req.user.company._id,
        stripeCustomerId: req.user.company.stripeCustomerId,
        file: req.file,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.post("/", authenticate.verifyToken, async (req, res, next) => {
  try {
    await companyUsersController.createCompanyUser({
      companyId: req.user.company._id,
      companyUserData: req.body,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_USER_CREATED,
      data: {},
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyUsersDebugger(err);

    next(err);
  }
});

router.get(
  "/:userId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      userId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyUser = await companyUsersController.readCompanyUser({
        companyId: req.user.company._id,
        userId: req.params.userId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_FETCHED,
        data: companyUser,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:userId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      userId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyUsersController.updateCompanyUser({
        companyId: req.user.company._id,
        userId: req.params.userId,
        companyUserData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/:userId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      userId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyUsersController.deleteCompanyUser({
        companyId: req.user.company._id,
        currentUser: req.user,
        userId: req.params.userId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyUsersDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
