const express = require("express");
const Joi = require("joi");
const userDebugger = require("debug")("debug:user");

const { upload } = require("../startup/multer.config");
const { authenticate, validate } = require("../middlewares");
const { usersController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.post(
  "/get-dashboard-data",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      graphScope: Joi.object().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const dashboardData = await usersController.readDashboardData({
        currentUserId: req.user._id,
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.DASHBOARD_DATA_FETCHED,
        data: dashboardData,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.get("/me", authenticate.verifyToken, async (req, res, next) => {
  try {
    const currentUser = await usersController.readCurrentUser({
      currentUserId: req.user._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_CURRENT_USER,
      data: currentUser,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

    next(err);
  }
});

router.patch(
  "/",
  upload.single("profilePicture"),
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email(),
      password: Joi.string().min(6).max(20),
      firstName: Joi.string(),
      lastName: Joi.string(),
      companyName: Joi.string(),
      phoneNumber: Joi.string(),
      secondaryEmail: Joi.string(),
      companySize: Joi.string(),
      address: Joi.string(),
      postalCode: Joi.string(),
      city: Joi.string(),
      province: Joi.string(),
      country: Joi.string(),
      role: Joi.string(),
      signUpStepsCompleted: Joi.number().positive().strict().min(1).max(8),
      watchTutorialStepsCompleted: Joi.number()
        .positive()
        .strict()
        .min(1)
        .max(8),
      contactsDisplayOrder: Joi.array(),
      contactSelectionCriteria: Joi.array().items(
        Joi.object({
          filterKey: Joi.string().required(),
          filterValues: Joi.array().required(),
          _id: Joi.string().optional(),
        })
      ),
      emailKey: Joi.string(),
      region: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    try {
      const updatedUser = await usersController.updateUser({
        ...req.body,
        profilePicture: req.file,
        currentUser: req.user,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.USER_UPDATED,
        data: updatedUser,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      emailAddress: Joi.string().email().required(),
      name: Joi.string().required(),
      roleId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await usersController.createUserUnderACompany({
        ...req.body,
        companyId: req.user.company._id,
        currentUserId: req.user._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const users = await usersController.readAllUsersUnderACompany({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_USERS_FETCHED,
      data: users,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

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
      const user = await usersController.readUserUnderACompany({
        companyId: req.user.company._id,
        ...req.params,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_FETCHED,
        data: user,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

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
      const users = await usersController.readPaginatedUsersUnderACompany({
        ...req.query,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USERS_FETCHED,
        data: users,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

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
    body: Joi.object({
      roleId: Joi.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await usersController.updateUserUnderACompany({
        companyId: req.user.company._id,
        ...req.params,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/referral-codes/verify",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      referralCode: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const reward = await usersController.verifyReferralCode({
        ...req.body,
        currentUserId: req.user._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.REFERRAL_CODE_ACCEPTED,
        data: reward,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

router.delete('/delete-company-logo',
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await usersController.deleteCompanyLogo({
        currentUser: req.user,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.LOGO_DELETED,
        data: {},
      });
    } catch (err) {
      userDebugger(err);

      next(err);
    }
  }
);

router.post('/company-logo',
  upload.single('companyLogo'),
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const companyLogo = await usersController.addCompanyLogo({
        companyLogo: req.file,
        currentUser: req.user,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.LOGO_CREATED,
        data: {
          companyLogo,
        },
      });
    } catch (err) {
      userDebugger(err);

      next(err);
    }
  }
);

router.post('/skip-tour',
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const companyLogo = await usersController.skipTour({
        currentUser: req.user,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.TOUR_SKIPPED,
        data: {
          companyLogo,
        },
      });
    } catch (err) {
      userDebugger(err);

      next(err);
    }
  }
);

router.post('/complete-tour',
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      const companyLogo = await usersController.completeTour({
        currentUser: req.user,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.TOUR_COMPLETED,
        data: {
          companyLogo,
        },
      });
    } catch (err) {
      userDebugger(err);

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
      await usersController.deleteUserUnderACompany({
        companyId: req.user.company._id,
        currentUser: req.user,
        ...req.params,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_USER_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      userDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
