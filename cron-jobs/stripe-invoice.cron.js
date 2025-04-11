const moment = require("moment");
const CronJob = require("cron").CronJob;
const { Company } = require("../models");
const {
  stripeController,
  companyContactsController,
} = require("../controllers");

new CronJob(
  "0 0 * * *",
  async function () {
    console.log(`called stripe-invoice.cron at ${moment().format("LLL")}`);
    try {
      let companies = await Company.find({
        stripeCustomerId: { $ne: null },
      });
      await Promise.all(
        companies?.map(async (company) => {
          const stripeCustomerId = company.stripeCustomerId;
          const companyId = company._id;
          const companyExistingContacts =
            await companyContactsController.readCompanyContactsCount({
              companyId,
            });
          await stripeController.calculateAndChargeContactOverage({
            companyId,
            stripeCustomerId,
            importedContactsCount: 0,
            existingContactsCount: companyExistingContacts,
          });
        })
      );
    } catch (err) {
      console.log("Error during cron job execution:", err);
    }
  },
  null,
  true,
  "Asia/Karachi"
);
