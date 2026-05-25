import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/profile/photo/presign/route';

vi.mock('@/lib/s3-profile', () => ({
  generatePresignedUploadUrl: vi.fn(),
}));

import { generatePresignedUploadUrl } from '@/lib/s3-profile';

const mockGeneratePresignedUploadUrl = vi.mocked(generatePresignedUploadUrl);

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/profile/photo/presign', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/profile/photo/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns presigned URL structure for authenticated user', async () => {
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/bucket/presigned-url',
      objectKey: 'profiles/user-123/avatar-1700000000000.webp',
      cdnUrl: 'https://cdn.example.com/profiles/user-123/avatar-1700000000000.webp',
    });

    const req = createRequest({ 'x-user-id': 'user-123' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      uploadUrl: 'https://s3.amazonaws.com/bucket/presigned-url',
      objectKey: 'profiles/user-123/avatar-1700000000000.webp',
      cdnUrl: 'https://cdn.example.com/profiles/user-123/avatar-1700000000000.webp',
    });
    expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith('user-123');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = createRequest();
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    expect(mockGeneratePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('handles S3 errors gracefully', async () => {
    mockGeneratePresignedUploadUrl.mockRejectedValue(new Error('S3 error'));

    const req = createRequest({ 'x-user-id': 'user-123' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to generate presigned URL', code: 'PRESIGN_FAILED' });
  });
});
