import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { generatePresignedUploadUrl } from '@/lib/s3-profile';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const result = await generatePresignedUploadUrl(user.userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate presigned URL', code: 'PRESIGN_FAILED' },
      { status: 500 }
    );
  }
}
