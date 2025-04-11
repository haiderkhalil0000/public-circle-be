const moment = require("moment");
const CronJob = require("cron").CronJob;
const { Company } = require("../models");
const { stripeController } = require("../controllers");

async function retryRequest(fn, retries = 5, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (err.response && err.response.status === 429 && retries > 0) {
      console.log(`Rate limit hit. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

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
          const customerUpcomingInvoice = await retryRequest(() =>
            stripeController.readCustomerUpcomingInvoices({ stripeCustomerId })
          );

          if (customerUpcomingInvoice) {
            const today = moment().startOf("day");
            const upcomingInvoiceDate = moment(
              customerUpcomingInvoice.createdAt,
              "YYYY-MM-DD hh:mm:ss A"
            ).startOf("day");

            if (
              today.isSame(upcomingInvoiceDate) ||
              today.isAfter(upcomingInvoiceDate)
            ) {
              await Company.updateOne(
                { _id: company._id },
                { isContactFinalize: false }
              );
            }
          }
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
