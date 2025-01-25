const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const { Segment } = require("../models");
const {
  RESPONSE_MESSAGES,
  DOCUMENT_STATUS,
} = require("../utils/constants.util");
const { basicUtil } = require("../utils");

const createSegment = async ({ name, filters, companyId }) => {
  const existingSegment = await Segment.findOne({
    name,
    company: companyId,
    status: DOCUMENT_STATUS.ACTIVE,
  });

  if (existingSegment) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_SEGMENT,
    });
  }

  Segment.create({
    name,
    filters,
    company: companyId,
  });
};

const readSegment = async ({ segmentId }) => {
  basicUtil.validateObjectId({ inputString: segmentId });

  const segment = await Segment.findById(segmentId);

  if (!segment) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  return segment;
};

const readPaginatedSegments = async ({ companyId, pageNumber, pageSize }) => {
  const promises = [];
  const companyContactsController = require("./company-contacts.controller");

  let [totalRecords, segments] = await Promise.all([
    Segment.countDocuments({
      company: companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    }),
    Segment.find({
      company: companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  for (const segment of segments) {
    promises.push(
      companyContactsController.readFiltersCount({
        filters: segment.filters,
        companyId,
      })
    );
  }

  const filtersCountArray = await Promise.all(promises);

  segments.forEach((item, index) => {
    const filterCounts = filtersCountArray[index].map(
      (subItem) => subItem.filterCount
    );

    const totalFilterCount = filterCounts.reduce((acc, curr) => acc + curr, 0);

    item.usersCount = totalFilterCount;
  });

  return { totalRecords, segments };
};

const readAllSegments = async ({ companyId }) => {
  const promises = [];
  const companyContactsController = require("./company-contacts.controller");

  const allSegments = await Segment.find({
    company: companyId,
    status: DOCUMENT_STATUS.ACTIVE,
  }).lean();

  for (const segment of allSegments) {
    promises.push(
      companyContactsController.readFiltersCount({
        filters: segment.filters,
        companyId,
      })
    );
  }

  const filtersCountArray = await Promise.all(promises);

  allSegments.forEach((item, index) => {
    const filterCounts = filtersCountArray[index].map(
      (subItem) => subItem.filterCount
    );

    const totalFilterCount = filterCounts.reduce((acc, curr) => acc + curr, 0);

    item.usersCount = totalFilterCount;
  });

  return allSegments;
};

const updateSegment = async ({ segmentId, segmentData }) => {
  basicUtil.validateObjectId({ inputString: segmentId });

  const result = await Segment.updateOne(
    { _id: segmentId },
    { ...segmentData }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_UPDATED_ALREADY,
    });
  }
};

const deleteSegment = async ({ segmentId }) => {
  segmentId = new mongoose.Types.ObjectId(segmentId);

  const result = await Segment.updateOne(
    { _id: segmentId },
    {
      status: DOCUMENT_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createSegment,
  readSegment,
  readPaginatedSegments,
  readAllSegments,
  updateSegment,
  deleteSegment,
};
