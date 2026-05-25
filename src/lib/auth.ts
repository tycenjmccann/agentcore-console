import { NextRequest } from 'next/server';

// TODO: Replace with proper session/JWT auth middleware (e.g., NextAuth, custom JWT validation)
export function getUserFromRequest(req: NextRequest): { userId: string } | null {
  const userId = req.headers.get('x-user-id');
  if (!userId) return null;
  return { userId };
}
