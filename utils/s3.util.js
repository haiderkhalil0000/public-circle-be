const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({ region: "ca-central-1" });

const { S3BUCKET, AWS_REGION } = process.env;

const uploadTemplateThumbnail = async ({ s3Path, buffer }) => {
  const uploadParams = {
    Bucket: S3BUCKET,
    Key: s3Path,
    Body: buffer,
    ContentType: "image/png",
  };

  const command = new PutObjectCommand(uploadParams);

  await s3Client.send(command);

  const publicUrl = `https://${S3BUCKET}.s3.${
    AWS_REGION || "ca-central-1"
  }.amazonaws.com/${s3Path}`;

  console.log(`Thumbnail uploaded successfully to s3://${S3BUCKET}/${s3Path}`);

  return publicUrl;
};

module.exports = {
  uploadTemplateThumbnail,
};
