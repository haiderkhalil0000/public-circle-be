const { Reward } = require("../models");

const getCouponName = ({ reward }) => {
  if (Object.keys(reward.discounts)) {
    const { fixedDiscount, percentageDiscount } = reward.discounts;

    return `${
      fixedDiscount
        ? `${fixedDiscount}${reward.currencySymbol} fixed discount`
        : `${percentageDiscount}% discount`
    } for ${reward.discountInDays} days`;
  } else {
    return `trial for ${reward.trialInDays} days`;
  }
};

const createReward = async ({
  kind,
  trialInDays,
  discountInDays,
  discounts,
}) => {
  const newReward = await Reward.create({
    kind,
    trialInDays,
    discountInDays,
    discounts,
  });

  const stripeController = require("./stripe.controller");

  await stripeController.createCoupon({
    id: newReward.id,
    name: getCouponName({ reward: newReward }),
    amountOff: newReward.discounts.fixedDiscount ?? 0,
    percentageOff: newReward.discounts.percentageDiscount ?? 0,
  });
};

const readReward = () => {};

const readPaginatedRewards = () => {};

const readAllRewards = () => {};

module.exports = {
  createReward,
  readReward,
  readPaginatedRewards,
  readAllRewards,
};
