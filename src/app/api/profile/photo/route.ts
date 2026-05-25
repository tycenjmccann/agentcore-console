import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { deleteObject, getUserAvatarKey, clearUserAvatarKey } from '@/lib/s3-profile';

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const avatarKey = getUserAvatarKey(user.userId);
    if (!avatarKey) {
      return NextResponse.json(
        { error: 'No avatar exists for this user', code: 'NO_AVATAR' },
        { status: 404 }
      );
    }

    await deleteObject(avatarKey);
    clearUserAvatarKey(user.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete avatar', code: 'DELETE_FAILED' },
      { status: 500 }
    );
  }
}
