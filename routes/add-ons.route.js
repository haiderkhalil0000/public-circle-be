const express = require("express");
const roleDebugger = require("debug")("debug:role");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { addOnsController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      price: Joi.number().required(),
      currency: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await addOnsController.createAddOn(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ADD_ON_CREATED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      roleDebugger(err);

      next(err);
    }
  }
);

router.get("/all", authenticate.verifyToken, async (req, res, next) => {
  try {
    const addOns = await addOnsController.readAllAddOns();

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_ADD_ON_FETCHED,
      data: addOns,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    roleDebugger(err);

    next(err);
  }
});

router.delete(
  "/:addOnId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      addOnId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await addOnsController.deleteAddOn(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ADD_ON_DELETED,
        data: {},
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      roleDebugger(err);

      next(err);
    }
  }
);

module.exports = router;
