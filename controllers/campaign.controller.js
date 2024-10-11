const mongoose = require("mongoose");
const { Campaign } = require("../models");
const { DOCUMENT_STATUS } = require("../utils/constants.util");

const createCampaign = ({
  companyId,
  filters,
  sourceEmailAddress,
  emailSubject,
  emailContent,
}) => {
  Campaign.create({
    companyId,
    filters,
    sourceEmailAddress,
    emailSubject,
    emailContent,
  });
};

const readCampaign = ({ campaignId = "" }) => {
  return Campaign.findById(new mongoose.Types.ObjectId(campaignId));
};

const readAllCampaigns = async ({
  companyId,
  pageNumber = 1,
  pageSize = 10,
}) => {
  const [totalRecords, allCampaigns] = await Promise.all([
    Campaign.countDocuments({ companyId }),
    Campaign.find({ companyId })
      .skip((parseInt(pageNumber) - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    totalRecords,
    allCampaigns,
  };
};

const updateCampaign = async ({ campaignId = "", campaignData }) => {
  await Campaign.updateOne(
    { _id: new mongoose.Types.ObjectId(campaignId) },
    { ...campaignData }
  );
};

const deleteCampaign = async ({ campaignId = "" }) => {
  await Campaign.findByIdAndUpdate(new mongoose.Types.ObjectId(campaignId), {
    status: DOCUMENT_STATUS.DELETED,
  });
};

module.exports = {
  createCampaign,
  readCampaign,
  readAllCampaigns,
  updateCampaign,
  deleteCampaign,
};
