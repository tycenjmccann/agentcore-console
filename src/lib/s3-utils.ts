import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AVATAR_BUCKET_NAME || 'agentcore-user-avatars';

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  // Sanitize user ID
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  
  // Generate unique key
  const timestamp = Date.now();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `user-avatars/${sanitizedUserId}/${timestamp}.${ext}`;
  
  // Convert File to Buffer
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    // Optional: Use presigned URLs instead of public-read
    // ACL: 'public-read'
  }));
  
  // Return URL
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export async function deleteAvatar(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  }));
}

// Helper functions for storing avatar keys
// (Use database in production, localStorage for prototype)
const avatarKeyMap = new Map<string, string>();

export function storeAvatarKey(userId: string, key: string): void {
  avatarKeyMap.set(userId, key);
}

export function getStoredAvatarKey(userId: string): string | null {
  return avatarKeyMap.get(userId) || null;
}

export function removeStoredAvatarKey(userId: string): void {
  avatarKeyMap.delete(userId);
}

export function extractKeyFromUrl(url: string): string {
  const match = url.match(/user-avatars\/[^/]+\/[^/]+/);
  return match ? match[0] : '';
}

export function constructAvatarUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}
