const { Role } = require("../models");
const { basicUtil } = require("../utils");
const { RESPONSE_MESSAGES, ROLE_STATUS } = require("../utils/constants.util");

const createRole = async ({ name, permissions }) => {
  const existingRoleDoc = await Role.findOne({
    name,
  });

  if (existingRoleDoc) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.ROLE_EXISTS_ALREADY,
    });
  }

  Role.create({
    name,
    permissions,
  });
};

const readRole = async ({ roleId }) => {
  basicUtil.validateObjectId({ inputString: roleId });

  const roleDoc = await Role.findById(roleId);

  if (!roleDoc) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ROLE_NOT_FOUND,
    });
  }

  return roleDoc;
};

const readPaginatedRoles = async ({ pageNumber, pageSize }) => {
  const [totalCount, roles] = await Promise.all([
    Role.countDocuments(),
    Role.find()
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalCount,
    roles,
  };
};

const readAllRoles = () => Role.find();

const updateRole = async ({ roleId, roleData }) => {
  basicUtil.validateObjectId({ inputString: roleId });

  const result = await Role.updateOne({ _id: roleId }, { ...roleData });

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ROLE_NOT_FOUND,
    });
  }
};

const deleteRole = async ({ roleId }) => {
  basicUtil.validateObjectId({ inputString: roleId });

  const result = await Role.updateOne(
    { _id: roleId },
    { status: ROLE_STATUS.DELETED }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.ROLE_NOT_FOUND,
    });
  }
};

module.exports = {
  createRole,
  readRole,
  readPaginatedRoles,
  readAllRoles,
  updateRole,
  deleteRole,
};
