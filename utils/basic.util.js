const _ = require("lodash");
const createHttpError = require("http-errors");
const jsonwebtoken = require("jsonwebtoken");

const { RESPONSE_MESSAGES } = require("./constants.util");

const validateObjectId = ({ inputString }) => {
  if (inputString.length !== 24 || !/^[a-fA-F0-9]{24}$/.test(inputString)) {
    throw createHttpError(400, {
      errorMessage: `${RESPONSE_MESSAGES.INVALID_OBJECT_ID}: ${inputString}`,
    });
  }

  return;
};

const decodeJwt = ({ jwt, jwtSecret }) => jsonwebtoken.verify(jwt, jwtSecret);

const fiterUniqueObjectsFromArray = (arrayOfObjects) =>
  _.uniqWith(arrayOfObjects, _.isEqual);

const fiterUniqueStringsFromArray = (arrayOfStrings) => _.uniq(arrayOfStrings);

const filterUniqueObjectsFromArrayByProperty = (arrayOfObjects, property) =>
  _.uniqBy(arrayOfObjects, property);

const calculateByteUnit = ({ bytes }) => {
  const units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  let index = 0;

  while (bytes >= 1000 && index < units.length - 1) {
    bytes /= 1000;
    index++;
  }

  return `${bytes} ${units[index]}`;
};

const isNumericString = (value) => {
  return typeof value === "string" && !isNaN(value) && value.trim() !== "";
};

module.exports = {
  validateObjectId,
  decodeJwt,
  fiterUniqueObjectsFromArray,
  fiterUniqueStringsFromArray,
  filterUniqueObjectsFromArrayByProperty,
  calculateByteUnit,
  isNumericString
};
