const createError = require("http-errors");
const mongoose = require("mongoose");

const { Segment } = require("../models");
const {
  RESPONSE_MESSAGES,
  DOCUMENT_STATUS,
} = require("../utils/constants.util");

const createSegment = async ({ name, filters, companyId }) => {
  const existingSegment = await Segment.findOne({
    name,
    companyId,
  });

  if (existingSegment) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_SEGMENT,
    });
  }

  Segment.create({
    name,
    filters,
    companyId,
  });
};

const readSegment = async ({ segmentId = "" }) => {
  if (segmentId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_SEGMENT_ID,
    });
  }

  segmentId = new mongoose.Types.ObjectId(segmentId);

  const segment = await Segment.findById(segmentId);

  if (!segment) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  return segment;
};

const readAllSegments = async ({ companyId, pageNumber, pageSize }) => {
  const [totalRecords, segments] = await Promise.all([
    Segment.countDocuments({ companyId }),
    Segment.find({
      companyId,
      status: DOCUMENT_STATUS.ACTIVE,
    })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  if (!segments.length) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.NO_SEGMENTS,
    });
  }

  return { totalRecords, segments };
};

const updateSegment = async ({ segmentId = "", segmentData }) => {
  if (segmentId.length !== 24) {
    throw createError(400, {
      errorMessage: RESPONSE_MESSAGES.INVALID_SEGMENT_ID,
    });
  }

  segmentId = new mongoose.Types.ObjectId(segmentId);

  const result = await Segment.updateOne(
    { _id: segmentId },
    { ...segmentData }
  );

  if (!result.matchedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_UPDATED_ALREADY,
    });
  }
};

const deleteSegment = async ({ segmentId = "" }) => {
  segmentId = new mongoose.Types.ObjectId(segmentId);

  const result = await Segment.updateOne(
    { _id: segmentId },
    {
      status: DOCUMENT_STATUS.DELETED,
    }
  );

  if (!result.matchedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_NOT_FOUND,
    });
  }

  if (!result.modifiedCount) {
    throw createError(404, {
      errorMessage: RESPONSE_MESSAGES.SEGMENT_DELETED_ALREADY,
    });
  }
};

module.exports = {
  createSegment,
  readSegment,
  readAllSegments,
  updateSegment,
  deleteSegment,
};
