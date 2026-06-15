import { NextResponse } from 'next/server';
import { getCredentials } from '@/lib/credentials';
import { getIntegration } from '@/lib/integrations/registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const creds = getCredentials(id);

  if (!creds) {
    return NextResponse.json({ connected: false, label: 'Not connected' });
  }

  const integration = getIntegration(id, creds);
  if (!integration) {
    return NextResponse.json({ connected: false, label: 'Unknown integration' });
  }

  const status = await integration.testConnection();
  return NextResponse.json(status);
}
