const express = require("express");
const Joi = require("joi");
const companyContactsDebugger = require("debug")("debug:company-contacts");

const { upload } = require("../startup/multer.config");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { authenticate, validate } = require("../middlewares");
const { companyContactsController } = require("../controllers");
const { CUSTOMER_REQUEST_TYPE } = require("../utils/constants.util");

const router = express.Router();

Joi.objectId = require("joi-objectid")(Joi);

router.get(
  "/primary-key/:primaryKey/effect",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      primaryKey: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const primaryKeyEffect =
        await companyContactsController.readPrimaryKeyEffect({
          companyId: req.user.company._id,
          ...req.params,
        });

      res.status(200).json({
        message: primaryKeyEffect,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.get("/primary-key", authenticate.verifyToken, async (req, res, next) => {
  try {
    const primaryKey = await companyContactsController.readPrimaryKey({
      companyId: req.user.company._id,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.PRIMARY_KEY_FETCHED,
      data: primaryKey,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyContactsDebugger(err);

    next(err);
  }
});

router.get(
  "/duplicates",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const duplicates =
        await companyContactsController.readCompanyContactDuplicates({
          companyId: req.user.company._id,
          ...req.query,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CONTACT_DUPLICATE_FETCHED,
        data: duplicates,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/finalize-contact",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await companyContactsController.finalizeCompanyContact({
        companyId: req.user.company._id
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CONTACTS_FINALIZED,
        data: {},
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/un-subscribe",
  validate({
    body: Joi.object({
      companyContactId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyContactsController.unSubscribeFromEmail({
        companyContactId: req.body.companyContactId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.UNSUBSCRIBED,
        data: {},
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/dedicated-ip-request",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      requested: Joi.boolean().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyContactsController.createDedicatedIpRequest({
        companyId: req.user.company._id,
        requested: req.body.requested,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.DEDICATED_IP_REQUEST_CREATED,
        data: {},
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/revert-finalize-contact-request",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await companyContactsController.createRevertFinalizeContactRequest({
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.REVERT_FINALIZE_CONTACTS_REQUEST_CREATED,
        data: {},
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/cancel/revert-finalize-contact-request",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await companyContactsController.cancelRevertFinalizeContactRequest({
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CANCEL_REVERT_FINALIZE_CONTACTS_REQUEST,
        data: {},
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/customer-requests",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      type: Joi.string()
        .valid(...Object.values(CUSTOMER_REQUEST_TYPE))
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const response = await companyContactsController.getCustomerRequests({
        companyId: req.user.company._id,
        type: req.query.type,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.CUSTOMER_REQUESTS_FETCHED,
        data: response,
      });
    } catch (err) {
      companyContactsDebugger(err);

      next(err);
    }
  }
);


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
      await companyContactsController.createPrimaryKey({
        companyId: req.user.company._id,
        currentUserId: req.user._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

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
      await companyContactsController.updatePrimaryKey({
        companyId: req.user.company._id,
        currentUserId: req.user._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.delete(
  "/primary-key",
  authenticate.verifyToken,
  async (req, res, next) => {
    try {
      await companyContactsController.deletePrimaryKey({
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.PRIMARY_KEY_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

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
        await companyContactsController.readContactKeys({
          companyId: req.user.company._id,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_FILTER_KEYS,
        data: possibleFilterKeys,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.get(
  "/contact-values",
  authenticate.verifyToken,
  validate({
    query: Joi.object({
      pageNumber: Joi.number().required(),
      pageSize: Joi.number().required(),
      key: Joi.string().required(),
      searchString: Joi.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const possibleFilterValues =
        await companyContactsController.readContactValues({
          companyId: req.user.company._id,
          ...req.query,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_POSSIBLE_VALUES,
        data: possibleFilterValues,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/get-filter-count",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      filters: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const filterCount = await companyContactsController.readFiltersCount({
        ...req.body,
        companyId: req.user.company._id,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.FETCHED_FILTER_COUNT,
        data: filterCount,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

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
      const autoCompleteData = await companyContactsController.search({
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

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const companyContacts =
      await companyContactsController.readAllCompanyContacts({
        companyId: req.user.company._id,
      });

    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_ALL_COMPANY_CONTACTS,
      data: companyContacts,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyContactsDebugger(err);

    next(err);
  }
});

router.post(
  "/get-paginated-contacts",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      pageNumber: Joi.number().optional(),
      pageSize: Joi.number().optional(),
      filters: Joi.array()
        .items(
          Joi.object({
            filterKey: Joi.string().required(),
            filterValues: Joi.array().required(),
          })
        )
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const companyContacts =
        await companyContactsController.readPaginatedCompanyContacts({
          companyId: req.user.company._id,
          ...req.body,
        });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACTS_FETCHED,
        data: companyContacts,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

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
      await companyContactsController.uploadCsv({
        companyId: req.user.company._id,
        stripeCustomerId: req.user.company.stripeCustomerId,
        currentUserId: req.user._id,
        emailAddress: req.user.emailAddress,
        file: req.file,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACTS_ADDED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post("/", authenticate.verifyToken, async (req, res, next) => {
  try {
    await companyContactsController.createCompanyContact({
      companyId: req.user.company._id,
      companyUserData: req.body,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_CONTACT_CREATED,
      data: {},
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyContactsDebugger(err);

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
      const companyContact = await companyContactsController.readCompanyContact(
        {
          companyId: req.user.company._id,
          userId: req.params.userId,
        }
      );

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACT_FETCHED,
        data: companyContact,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

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
      await companyContactsController.updateCompanyContact({
        companyId: req.user.company._id,
        userId: req.params.userId,
        companyUserData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACT_UPDATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/delete-contacts/selected",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      contactIds: Joi.array().items(Joi.string()).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyContactsController.deleteSelectedContacts({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACTS_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.delete("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    await companyContactsController.deleteAllCompanyContacts({
      companyId: req.user.company._id,
      currentUserKind: req.user.kind,
    });

    res.status(200).json({
      message: RESPONSE_MESSAGES.COMPANY_CONTACTS_DELETED,
      data: {},
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    companyContactsDebugger(err);

    next(err);
  }
});

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
      await companyContactsController.deleteCompanyContact({
        companyId: req.user.company._id,
        userId: req.params.userId,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.COMPANY_CONTACT_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/get-selection-effect",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      contactSelectionCriteria: Joi.array()
        .items(
          Joi.object({
            filterKey: Joi.string().required(),
            filterValues: Joi.array().required(),
          })
        )
        .required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const noOfAffectedContacts =
        await companyContactsController.getSelectionCriteriaEffect({
          companyId: req.user.company._id,
          ...req.body,
        });

      const contactWord = noOfAffectedContacts === 1 ? "contact" : "contacts";

      res.status(200).json({
        message: `${noOfAffectedContacts} ${contactWord} will be removed by this action`,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

router.post(
  "/resolve-duplicates",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      isSaveNewContact: Joi.boolean().optional(),
      contactsToBeSaved: Joi.array().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await companyContactsController.resolveCompanyContactDuplicates({
        companyId: req.user.company._id,
        ...req.body,
      });

      res.status(200).json({
        message: `Duplicate resolved successfully.`,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);

      companyContactsDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
