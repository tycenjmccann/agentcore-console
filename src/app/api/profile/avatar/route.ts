import { NextRequest, NextResponse } from 'next/server';
import { uploadAvatar, deleteAvatar, getStoredAvatarKey, storeAvatarKey, removeStoredAvatarKey, extractKeyFromUrl, constructAvatarUrl } from '@/lib/s3-utils';

/**
 * POST /api/profile/avatar
 * Upload a new avatar image
 */
export async function POST(req: NextRequest) {
  try {
    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 5MB' },
        { status: 400 }
      );
    }
    
    // Validate mime type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG and PNG files are supported' },
        { status: 400 }
      );
    }
    
    // TODO: Get user ID from session/auth
    // For now, use a placeholder
    const userId = 'user-123'; // Replace with actual auth
    
    // Get old avatar URL if exists
    const oldAvatarKey = getStoredAvatarKey(userId);
    
    // Upload to S3
    const avatarUrl = await uploadAvatar(file, userId);
    
    // Delete old avatar
    if (oldAvatarKey) {
      try {
        await deleteAvatar(oldAvatarKey);
      } catch (error) {
        console.error('Failed to delete old avatar:', error);
        // Continue even if deletion fails
      }
    }
    
    // Store new avatar key
    storeAvatarKey(userId, extractKeyFromUrl(avatarUrl));
    
    return NextResponse.json({ avatarUrl, status: 'success' });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile/avatar
 * Get current user's avatar URL
 */
export async function GET(req: NextRequest) {
  try {
    const userId = 'user-123'; // TODO: Get from session
    const avatarKey = getStoredAvatarKey(userId);
    
    if (!avatarKey) {
      return NextResponse.json({ avatarUrl: null }, { status: 404 });
    }
    
    const avatarUrl = constructAvatarUrl(avatarKey);
    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error('Avatar fetch error:', error);
    return NextResponse.json({ avatarUrl: null }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove the user's avatar
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = 'user-123'; // TODO: Get from session
    const avatarKey = getStoredAvatarKey(userId);
    
    if (avatarKey) {
      await deleteAvatar(avatarKey);
      removeStoredAvatarKey(userId);
    }
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }
}
