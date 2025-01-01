const express = require("express");
const roleDebugger = require("debug")("debug:role");
const Joi = require("joi");

const { authenticate, validate } = require("../middlewares");
const { rolesController } = require("../controllers");
const {
  constants: { RESPONSE_MESSAGES, ROLE_STATUS },
} = require("../utils");

const router = express.Router();

router.post(
  "/",
  authenticate.verifyToken,
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      permissions: Joi.array().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.createRole(req.body);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ROLE_CREATED,
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
    const roles = await rolesController.readAllRoles();

    res.status(200).json({
      message: RESPONSE_MESSAGES.ALL_ROLES_FETCHED,
      data: roles,
    });
  } catch (err) {
    // sendErrorReportToSentry(error);
    console.log(err);

    roleDebugger(err);

    next(err);
  }
});

router.get(
  "/:roleId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      roleId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const role = await rolesController.readRole(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ROLE_FETCHED,
        data: role,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      roleDebugger(err);

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
      const roles = await rolesController.readPaginatedRoles(req.query);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ROLES_FETCHED,
        data: roles,
      });
    } catch (err) {
      // sendErrorReportToSentry(error);
      console.log(err);

      roleDebugger(err);

      next(err);
    }
  }
);

router.patch(
  "/:roleId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      roleId: Joi.string().required(),
    }),
    body: Joi.object({
      name: Joi.string().required(),
      contactsRange: Joi.object(),
      status: Joi.string()
        .required()
        .valid(ROLE_STATUS.ACTIVE, ROLE_STATUS.ARCHIVED),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.updateRole({
        ...req.params,
        roleData: req.body,
      });

      res.status(200).json({
        message: RESPONSE_MESSAGES.ROLE_UPDATED,
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

router.delete(
  "/:roleId",
  authenticate.verifyToken,
  validate({
    params: Joi.object({
      roleId: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      await rolesController.deleteRole(req.params);

      res.status(200).json({
        message: RESPONSE_MESSAGES.ROLE_DELETED,
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
