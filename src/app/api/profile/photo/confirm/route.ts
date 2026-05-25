import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { verifyObjectExists, deleteObject, getUserAvatarKey, setUserAvatarKey } from '@/lib/s3-profile';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let body: { objectKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  if (!body.objectKey) {
    return NextResponse.json(
      { error: 'objectKey is required', code: 'MISSING_OBJECT_KEY' },
      { status: 400 }
    );
  }

  try {
    const exists = await verifyObjectExists(body.objectKey);
    if (!exists) {
      return NextResponse.json(
        { error: 'Object not found in S3', code: 'OBJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const previousKey = getUserAvatarKey(user.userId);
    if (previousKey) {
      await deleteObject(previousKey);
    }

    setUserAvatarKey(user.userId, body.objectKey);

    const cdnBaseUrl = process.env.CDN_BASE_URL!;
    const avatarUrl = `${cdnBaseUrl}/${body.objectKey}`;

    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to confirm upload', code: 'CONFIRM_FAILED' },
      { status: 500 }
    );
  }
}
