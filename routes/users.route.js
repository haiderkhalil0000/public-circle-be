const fs = require("fs");
const express = require("express");
const userDebugger = require("debug")("debug:user");
const csvParser = require("csv-parser");

const { authenticate } = require("../middlewares");
const { upload } = require("../startup/multer.config");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");
const { CompanyUser } = require("../models");

const router = express.Router();

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

router.get("/me", authenticate.verifyToken, async (req, res, next) => {
  try {
    res.status(200).json({
      message: RESPONSE_MESSAGES.FETCHED_CURRENT_USER,
      data: req.user,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);

    userDebugger(err);

    next(err);
  }
});

module.exports = router;
