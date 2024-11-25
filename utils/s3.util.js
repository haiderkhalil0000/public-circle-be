const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({ region: "us-east-1" });

const { S3BUCKET } = process.env;

const uploadTemplateThumbnail = async ({ s3Path, buffer }) => {
  const uploadParams = {
    Bucket: S3BUCKET,
    Key: s3Path,
    Body: buffer,
    ContentType: "image/png",
  };

  const command = new PutObjectCommand(uploadParams);

  await s3Client.send(command);

  const presignedUrl = await getSignedUrl(s3Client, command);

  console.log(`Thumbnail uploaded successfully to s3://${S3BUCKET}/${s3Path}`);

  console.log(response);

  return presignedUrl;
};

module.exports = {
  uploadTemplateThumbnail,
};
