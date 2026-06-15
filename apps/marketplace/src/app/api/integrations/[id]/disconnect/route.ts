import { NextResponse } from 'next/server';
import { deleteCredentials } from '@/lib/credentials';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteCredentials(id);
  return NextResponse.json({ disconnected: true });
}
