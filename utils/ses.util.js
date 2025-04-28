const {
  SendEmailCommand,
  VerifyEmailIdentityCommand,
  ListIdentitiesCommand,
  VerifyDomainIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  DeleteIdentityCommand,
  VerifyDomainDkimCommand
} = require("@aws-sdk/client-ses");

const { sesClient } = require("../startup/ses.config");
const { TEMPLATE_CONTENT_TYPE } = require("./constants.util");

const sendEmail = async ({
  fromEmailAddress,
  toEmailAddress,
  subject,
  content,
  contentType,
}) => {
  const result = await sesClient.send(
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
          [contentType === TEMPLATE_CONTENT_TYPE.HTML ? "Html" : "Text"]: {
            Charset: "UTF-8",
            Data: content,
          },
        },
      },
      ConfigurationSetName: "public-circles",
    })
  );

  return result;
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
  const domainIdentityCommand = new VerifyDomainIdentityCommand({
    Domain: emailDomain,
  });
  const domainIdentityResponse = await sesClient.send(domainIdentityCommand);

  const dnsRecords = [];

  dnsRecords.push({
    Name: `_amazonses.${emailDomain}`,
    Type: "TXT",
    Value: domainIdentityResponse.VerificationToken,
  });

  const dkimCommand = new VerifyDomainDkimCommand({
    Domain: emailDomain,
  });
  const dkimResponse = await sesClient.send(dkimCommand);

  if (dkimResponse.DkimTokens && dkimResponse.DkimTokens.length > 0) {
    dkimResponse.DkimTokens.forEach((token) => {
      dnsRecords.push({
        Name: `${token}._domainkey.${emailDomain}`,
        Type: "CNAME",
        Value: `${token}.dkim.amazonses.com`,
      });
    });
  }

  return dnsRecords;
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
