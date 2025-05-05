const createHttpError = require("http-errors");

const {
  sendVerificationEmail,
  listVerifiedIdentities,
  verifyDomain,
  deleteIdentity,
} = require("../utils/ses.util");
const {
  RESPONSE_MESSAGES,
  DOCUMENT_STATUS,
  TOUR_STEPS,
} = require("../utils/constants.util");
const { Configuration, User } = require("../models");

const addDataInCompanyConfigurations = async ({
  companyId,
  emailAddress,
  emailDomain,
}) => {
  const query = { company: { $ne: companyId } };
  let errorMessage = "";

  if (emailAddress) {
    query["emailConfigurations.addresses"] = {
      $elemMatch: {
        emailAddress,
        isVerified: true,
      },
    };

    errorMessage = RESPONSE_MESSAGES.DUPLICATE_EMAIL;
  } else if (emailDomain) {
    query["emailConfigurations.domains"] = {
      $elemMatch: {
        emailDomain,
        isVerified: true,
      },
    };

    errorMessage = RESPONSE_MESSAGES.DUPLICATE_DOMAIN;
  }

  const [configuration, isEmailOrDomainVerifiedByOtherCompany] =
    await Promise.all([
      Configuration.findOne({ company: companyId }),
      Configuration.findOne(query),
    ]);

  if (isEmailOrDomainVerifiedByOtherCompany) {
    throw createHttpError(400, {
      errorMessage,
    });
  }

  if (!configuration) {
    await Configuration.create({
      company: companyId,
      emailConfigurations: {
        [emailAddress ? "addresses" : "domains"]: [
          {
            [emailAddress ? "emailAddress" : "emailDomain"]: emailAddress
              ? emailAddress
              : emailDomain,
            isDefault: true,
          },
        ],
      },
    });
  } else {
    const existingEmailsOrDomains = JSON.parse(
      JSON.stringify(
        configuration.emailConfigurations[
          emailAddress ? "addresses" : "domains"
        ]
      )
    );

    const duplicateEmailOrDomain = existingEmailsOrDomains.find((item) => {
      if (emailAddress) {
        return (
          item.emailAddress === emailAddress &&
          item.status === DOCUMENT_STATUS.ACTIVE
        );
      } else if (emailDomain) {
        return (
          item.emailDomain === emailDomain &&
          item.status === DOCUMENT_STATUS.ACTIVE
        );
      }
    });

    if (duplicateEmailOrDomain) {
      throw createHttpError(400, {
        errorMessage: [
          emailAddress
            ? RESPONSE_MESSAGES.DUPLICATE_EMAIL
            : RESPONSE_MESSAGES.DUPLICATE_DOMAIN,
        ],
      });
    }

    configuration.emailConfigurations[
      emailAddress ? "addresses" : "domains"
    ].forEach((item) => {
      item.isDefault = false;
    });

    configuration.emailConfigurations[
      emailAddress ? "addresses" : "domains"
    ].push({
      [emailAddress ? "emailAddress" : "emailDomain"]: emailAddress
        ? emailAddress
        : emailDomain,
      isDefault: true,
    });

    await configuration.save();
  }
  await User.findOneAndUpdate(
    { emailAddress },
    {
      $set: {
        "tourSteps.steps.0.isCompleted": true,
      },
    }
  );
};

const initiateEmailVerification = async ({ companyId, emailAddress }) => {
  await addDataInCompanyConfigurations({ companyId, emailAddress });

  sendVerificationEmail({ emailAddress });
};

const verifyEmailAddress = async ({ emailAddress }) => {
  const verifiedIdentities = await listVerifiedIdentities();

  if (!verifiedIdentities.includes(emailAddress)) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_NOT_VERIFIED,
    });
  }
};

const initiateDomainVerification = async ({ companyId, emailDomain }) => {
  await addDataInCompanyConfigurations({ companyId, emailDomain });

  const dnsInfo = await verifyDomain({ emailDomain });

  await Configuration.updateOne(
    {
      company: companyId,
      "emailConfigurations.domains.emailDomain": emailDomain,
      "emailConfigurations.domains.status": DOCUMENT_STATUS.ACTIVE,
    },
    {
      $set: {
        "emailConfigurations.domains.$.dnsInfo": dnsInfo,
      },
    }
  );

  return dnsInfo;
};

const readConfigurations = async ({ companyId }) => {
  let [configuration, verifiedIdentities] = await Promise.all([
    Configuration.findOne({ company: companyId }),
    listVerifiedIdentities(),
  ]);

  if (!configuration) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.CONFIGURATION_NOT_FOUND,
    });
  }

  configuration.emailConfigurations.addresses.forEach((item) => {
    if (verifiedIdentities.includes(item.emailAddress)) {
      item.isVerified = true;
    }
  });

  configuration.emailConfigurations.domains.forEach((item) => {
    if (verifiedIdentities.includes(item.emailDomain)) {
      item.isVerified = true;
    }
  });

  configuration = JSON.parse(JSON.stringify(await configuration.save()));

  configuration.emailConfigurations.addresses =
    configuration.emailConfigurations.addresses.filter(
      (item) => item.status === DOCUMENT_STATUS.ACTIVE
    );

  configuration.emailConfigurations.domains =
    configuration.emailConfigurations.domains.filter(
      (item) => item.status === DOCUMENT_STATUS.ACTIVE
    );

  return configuration;
};

const checkDomainVerification = async ({ emailDomain }) => {
  const verifiedIdentities = await listVerifiedIdentities();

  if (!verifiedIdentities.includes(emailDomain)) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DOMAIN_NOT_VERIFIED,
    });
  }
};

const createConfiguration = async ({
  companyId,
  emailAddresses,
  emailDomains,
}) => {
  const configuration = await Configuration.findOne({ company: companyId });

  if (configuration) {
    throw createHttpError(404, {
      errorMessage: RESPONSE_MESSAGES.DUPLICATE_CONFIGURATION,
    });
  }

  Configuration.create({
    company: companyId,
    emailConfigurations: {
      addresses: emailAddresses,
      domains: emailDomains,
    },
  });
};

const deleteIdentityFromSES = ({ emailAddress, emailDomain }) => {
  deleteIdentity({ identity: emailAddress ? emailAddress : emailDomain });
};

const deleteEmailAddress = async ({ companyId, emailAddress }) => {
  const configuration = await Configuration.findOne({ company: companyId });

  let isUpdated = false;

  configuration.emailConfigurations.addresses.forEach((item) => {
    if (item.emailAddress === emailAddress) {
      item.status = DOCUMENT_STATUS.DELETED;
      isUpdated = true;
    }
  });

  configuration.emailConfigurations.domains.forEach((item) => {
    if (item.addresses.length) {
      item.addresses.forEach((item) => {
        if (item.emailAddress === emailAddress) {
          item.status = DOCUMENT_STATUS.DELETED;
          isUpdated = true;
        }
      });
    }
  });

  if (isUpdated) {
    await Promise.all([
      configuration.save(),
      deleteIdentityFromSES({ emailAddress }),
    ]);
  } else {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.EMAIL_NOT_FOUND,
    });
  }
};

const deleteEmailDomain = async ({ companyId, emailDomain }) => {
  const { modifiedCount } = await Configuration.updateOne(
    {
      company: companyId,
      "emailConfigurations.domains.emailDomain": emailDomain,
      "emailConfigurations.domains.status": DOCUMENT_STATUS.ACTIVE,
    },
    {
      $set: {
        "emailConfigurations.domains.$.status": DOCUMENT_STATUS.DELETED,
      },
    }
  );

  if (!modifiedCount) {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DOMAIN_NOT_FOUND,
    });
  }

  await deleteIdentityFromSES({ emailDomain });
};

const attachEmailWithDomain = async ({
  companyId,
  emailDomain,
  emailAddress,
}) => {
  const configuration = await Configuration.findOne({ company: companyId });

  let isUpdated = false;

  configuration.emailConfigurations.domains.forEach((item) => {
    if (item.emailDomain === emailDomain) {
      const existingEmailAddress = item.addresses.find(
        (item) =>
          item.emailAddress === emailAddress &&
          item.status === DOCUMENT_STATUS.ACTIVE
      );

      if (existingEmailAddress) {
        throw createHttpError(400, {
          errorMessage: RESPONSE_MESSAGES.DUPLICATE_EMAIL,
        });
      }

      item.addresses.push({ emailAddress, isDefault: true });

      isUpdated = true;
    }
  });

  if (isUpdated) {
    return configuration.save();
  } else {
    throw createHttpError(400, {
      errorMessage: RESPONSE_MESSAGES.DOMAIN_NOT_FOUND,
    });
  }
};

const readVerifiedEmailAddresses = async ({ companyId }) => {
  const configuration = await Configuration.findOne({
    company: companyId,
  }).lean();

  const { emailConfigurations } = configuration ?? {};
  let verifiedEmailAddresses = [];

  emailConfigurations?.addresses.forEach((item) => {
    if (item.isVerified && item.status === DOCUMENT_STATUS.ACTIVE) {
      verifiedEmailAddresses.push(item.emailAddress);
    }
  });

  emailConfigurations?.domains.forEach((item) => {
    item.addresses.forEach((item) => {
      if (item.status === DOCUMENT_STATUS.ACTIVE) {
        verifiedEmailAddresses.push(item.emailAddress);
      }
    });
  });

  return verifiedEmailAddresses;
};

module.exports = {
  initiateEmailVerification,
  verifyEmailAddress,
  initiateDomainVerification,
  readConfigurations,
  checkDomainVerification,
  createConfiguration,
  deleteEmailAddress,
  deleteEmailDomain,
  attachEmailWithDomain,
  readVerifiedEmailAddresses,
};
