import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const CDN_BASE_URL = process.env.CDN_BASE_URL!;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({ region: AWS_REGION });

// TODO: Replace with DynamoDB-backed metadata store
const avatarMetadata = new Map<string, string>();

export async function generatePresignedUploadUrl(userId: string) {
  const timestamp = Date.now();
  const objectKey = `profiles/${userId}/avatar-${timestamp}.webp`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: objectKey,
    ContentType: 'image/webp',
    ContentLength: 5242880,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
  const cdnUrl = `${CDN_BASE_URL}/${objectKey}`;

  return { uploadUrl, objectKey, cdnUrl };
}

export async function verifyObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  }));
}

export function getUserAvatarKey(userId: string): string | undefined {
  return avatarMetadata.get(userId);
}

export function setUserAvatarKey(userId: string, key: string): void {
  avatarMetadata.set(userId, key);
}

export function clearUserAvatarKey(userId: string): void {
  avatarMetadata.delete(userId);
}
