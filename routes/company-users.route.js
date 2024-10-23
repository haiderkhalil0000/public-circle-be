const fs = require("fs");
const express = require("express");
const Joi = require("joi");
const csvParser = require("csv-parser");
const companyUsersDebugger = require("debug")("debug:users-data-set");

const { upload } = require("../startup/multer.config");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { CompanyUser } = require("../models");
const { authenticate, validate } = require("../middlewares");
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
        message: RESPONSE_MESSAGES.FETCHED_COMPANY_USERS,
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
  upload.single("csvFile"), // Make sure your file input has name="csvFile"
  async (req, res, next) => {
    try {
      const results = [];
      const promises = [];

      // Check if a file was uploaded
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Read and parse the CSV file from disk
      fs.createReadStream(req.file.path)
        .pipe(csvParser()) // Parse the CSV file
        .on("data", (data) => {
          results.push(data); // Collect each row of CSV data
        })
        .on("end", async () => {
          try {
            // Create promises for database insertion
            results.forEach((item) => {
              promises.push(
                CompanyUser.create({
                  ...item,
                  companyId: req.user.company._id,
                })
              ); // Assuming CompanyUser.create() returns a promise
            });

            // Wait for all the promises to resolve
            await Promise.all(promises);

            // Optionally, remove the file after processing (to avoid leaving files on disk)
            fs.unlink(req.file.path, (err) => {
              if (err) {
                console.error("Error removing file:", err);
              } else {
                console.log("File removed successfully.");
              }
            });

            // Send response after all data has been inserted
            res.send("CSV file processed successfully.");
          } catch (dbError) {
            // Handle any errors that occurred during the database insertion
            console.error("Error inserting CSV data into database:", dbError);
            res
              .status(500)
              .send(
                "An error occurred while inserting CSV data into the database."
              );
          }
        })
        .on("error", (err) => {
          // Handle any errors that occur during file reading
          console.error("Error reading CSV file:", err);
          res
            .status(500)
            .send("An error occurred while processing the CSV file.");
        });
    } catch (err) {
      console.error("Server error:", err);
      next(err); // Pass the error to the Express error handler
    }
  }
);

module.exports = router;
