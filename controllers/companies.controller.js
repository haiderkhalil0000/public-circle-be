const { Types } = require("mongoose");
const { Company, Campaign } = require("../models");
const {
  constants: { CAMPAIGN_STATUS },
} = require("../utils");

const readCompanyById = ({ companyId }) => Company.findById(companyId).lean();

const readCompanyActiveOngoingCampaigns = async ({ companyId }) => {
  return Campaign.aggregate([
		{
			$match: {
				company: new Types.ObjectId(companyId),
				status: CAMPAIGN_STATUS.ACTIVE,
				isOnGoing: true,
			},
		},
		{
			$addFields: {
				segments: {
					$map: {
						input: "$segments",
						as: "segmentId",
						in: { $toObjectId: "$$segmentId" },
					},
				},
			},
		},
		{
			$lookup: {
				from: "segments",
				localField: "segments",
				foreignField: "_id",
				as: "segments",
			},
		},
		{
			$project: {
				_id: 1,
				company: 1,
				segments: 1,
				sourceEmailAddress: 1,
				emailSubject: 1,
				emailTemplate: 1,
				runMode: 1,
				isRecurring: 1,
				isOnGoing: 1,
				cronStatus: 1,
				processedCount: 1,
				history: 1,
				frequency: 1,
				status: 1,
				createdAt: 1,
				updatedAt: 1,
				lastProcessed: 1,
			},
		},
  ]);
};



module.exports = {
  readCompanyById,
  readCompanyActiveOngoingCampaigns,
};
