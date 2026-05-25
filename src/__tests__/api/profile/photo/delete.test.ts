import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/profile/photo/route';

vi.mock('@/lib/s3-profile', () => ({
  deleteObject: vi.fn(),
  getUserAvatarKey: vi.fn(),
  clearUserAvatarKey: vi.fn(),
}));

import { deleteObject, getUserAvatarKey, clearUserAvatarKey } from '@/lib/s3-profile';

const mockDeleteObject = vi.mocked(deleteObject);
const mockGetUserAvatarKey = vi.mocked(getUserAvatarKey);
const mockClearUserAvatarKey = vi.mocked(clearUserAvatarKey);

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'DELETE',
    headers,
  });
}

describe('DELETE /api/profile/photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes object and clears metadata for authenticated user', async () => {
    mockGetUserAvatarKey.mockReturnValue('profiles/user-123/avatar-1700000000000.webp');
    mockDeleteObject.mockResolvedValue(undefined);

    const req = createRequest({ 'x-user-id': 'user-123' });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockDeleteObject).toHaveBeenCalledWith('profiles/user-123/avatar-1700000000000.webp');
    expect(mockClearUserAvatarKey).toHaveBeenCalledWith('user-123');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = createRequest();
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('returns 404 when no avatar exists', async () => {
    mockGetUserAvatarKey.mockReturnValue(undefined);

    const req = createRequest({ 'x-user-id': 'user-123' });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'No avatar exists for this user', code: 'NO_AVATAR' });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });
});
