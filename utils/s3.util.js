const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({ region: "ca-central-1" });

const { S3BUCKET, AWS_REGION, S3_URL_EXPIRY_TIME } = process.env;

const uploadImageToS3 = async ({ s3Path, buffer }) => {
  const uploadParams = {
    Bucket: S3BUCKET,
    Key: s3Path,
    Body: buffer,
    ContentType: "image/png",
  };

  const command = new PutObjectCommand(uploadParams); 

  await s3Client.send(command);

  return `https://${S3BUCKET}.s3.${
    AWS_REGION || "ca-central-1"
  }.amazonaws.com/${s3Path}`;
};

const generateUploadFileSignedUrl = async (fileNameWithPath, contentType) => {
  try {
    const expiresIn = +(S3_URL_EXPIRY_TIME || 600);
    
    const params = {
      Bucket: S3BUCKET,
      Key: fileNameWithPath,
      ContentType: contentType,
    };
    
    const signedUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand(params),
      { expiresIn: expiresIn }
    );
    
    return signedUrl;
  } catch (error) {
    console.error("Error while generating pre-signed URL:", error);
    throw new Error("Error while generating pre-signed URL");
  }
};

const deleteFileFromS3 = async (s3Path) => {
  const deleteParams = {
    Bucket: S3BUCKET,
    Key: s3Path,
  };

  const command = new DeleteObjectCommand(deleteParams);

  return await s3Client.send(command);
};


const s3FileCompleteUrl = (s3Path) => {
  return `https://${S3BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Path}`;
};

module.exports = {
  uploadImageToS3,
  generateUploadFileSignedUrl,
  deleteFileFromS3,
  s3FileCompleteUrl
};
