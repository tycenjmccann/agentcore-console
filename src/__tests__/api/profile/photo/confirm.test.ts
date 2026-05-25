import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/profile/photo/confirm/route';

vi.mock('@/lib/s3-profile', () => ({
  verifyObjectExists: vi.fn(),
  deleteObject: vi.fn(),
  getUserAvatarKey: vi.fn(),
  setUserAvatarKey: vi.fn(),
}));

import { verifyObjectExists, deleteObject, getUserAvatarKey, setUserAvatarKey } from '@/lib/s3-profile';

const mockVerifyObjectExists = vi.mocked(verifyObjectExists);
const mockDeleteObject = vi.mocked(deleteObject);
const mockGetUserAvatarKey = vi.mocked(getUserAvatarKey);
const mockSetUserAvatarKey = vi.mocked(setUserAvatarKey);

function createRequest(headers: Record<string, string> = {}, body?: object) {
  return new NextRequest('http://localhost:3000/api/profile/photo/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/profile/photo/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CDN_BASE_URL', 'https://cdn.example.com');
  });

  it('verifies object and stores metadata for authenticated user', async () => {
    mockVerifyObjectExists.mockResolvedValue(true);
    mockGetUserAvatarKey.mockReturnValue(undefined);

    const req = createRequest(
      { 'x-user-id': 'user-123' },
      { objectKey: 'profiles/user-123/avatar-1700000000000.webp' }
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      avatarUrl: 'https://cdn.example.com/profiles/user-123/avatar-1700000000000.webp',
    });
    expect(mockVerifyObjectExists).toHaveBeenCalledWith('profiles/user-123/avatar-1700000000000.webp');
    expect(mockSetUserAvatarKey).toHaveBeenCalledWith('user-123', 'profiles/user-123/avatar-1700000000000.webp');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = createRequest({}, { objectKey: 'profiles/user-123/avatar.webp' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  });

  it('returns 400 for missing objectKey', async () => {
    const req = createRequest({ 'x-user-id': 'user-123' }, {});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'objectKey is required', code: 'MISSING_OBJECT_KEY' });
  });

  it('returns 404 when object does not exist in S3', async () => {
    mockVerifyObjectExists.mockResolvedValue(false);

    const req = createRequest(
      { 'x-user-id': 'user-123' },
      { objectKey: 'profiles/user-123/nonexistent.webp' }
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Object not found in S3', code: 'OBJECT_NOT_FOUND' });
  });

  it('deletes old avatar when replacing', async () => {
    mockVerifyObjectExists.mockResolvedValue(true);
    mockGetUserAvatarKey.mockReturnValue('profiles/user-123/avatar-old.webp');
    mockDeleteObject.mockResolvedValue(undefined);

    const req = createRequest(
      { 'x-user-id': 'user-123' },
      { objectKey: 'profiles/user-123/avatar-new.webp' }
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockDeleteObject).toHaveBeenCalledWith('profiles/user-123/avatar-old.webp');
    expect(mockSetUserAvatarKey).toHaveBeenCalledWith('user-123', 'profiles/user-123/avatar-new.webp');
  });
});
