const {
  SendEmailCommand,
  VerifyEmailIdentityCommand,
  ListIdentitiesCommand,
  VerifyDomainIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  DeleteIdentityCommand,
} = require("@aws-sdk/client-ses");

const { sesClient } = require("../startup/ses.config");
const { TEMPLATE_KINDS } = require("./constants.util");

const sendEmail = async ({
  fromEmailAddress,
  toEmailAddress,
  subject,
  content,
  contentType,
}) => {
  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmailAddress,
      Destination: {
        ToAddresses: [toEmailAddress],
      },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
        Body: {
          [contentType === TEMPLATE_KINDS.HTML ? "Html" : "Text"]: {
            Charset: "UTF-8",
            Data: content,
          },
        },
      },
    })
  );
};

const sendVerificationEmail = ({ emailAddress }) => {
  const command = new VerifyEmailIdentityCommand({
    EmailAddress: emailAddress,
  });

  sesClient.send(command);
};

const listVerifiedIdentities = async () => {
  const command = new ListIdentitiesCommand({});

  const { Identities } = await sesClient.send(command);

  const verificationCommand = new GetIdentityVerificationAttributesCommand({
    Identities,
  });

  const verificationData = await sesClient.send(verificationCommand);
  const verificationAttributes = verificationData.VerificationAttributes;

  const verifiedIdentities = Identities.filter((identity) => {
    return (
      verificationAttributes[identity] &&
      verificationAttributes[identity].VerificationStatus === "Success"
    );
  });

  return verifiedIdentities;
};

const verifyDomain = async ({ emailDomain }) => {
  const command = new VerifyDomainIdentityCommand({ Domain: emailDomain });

  const data = await sesClient.send(command);

  return {
    Name: `_amazonses.${emailDomain}`,
    Type: "TXT",
    Value: data.VerificationToken,
  };
};

const deleteIdentity = async ({ identity }) => {
  const command = new DeleteIdentityCommand({
    Identity: identity,
  });

  sesClient.send(command);
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  listVerifiedIdentities,
  verifyDomain,
  deleteIdentity,
};
