import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.MARKETPLACE_API_KEY;

export function requireAuth(request: NextRequest): NextResponse | null {
  if (!API_KEY) return null;

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || token !== API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
