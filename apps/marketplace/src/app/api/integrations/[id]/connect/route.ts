import { NextRequest, NextResponse } from 'next/server';
import { setCredentials } from '@/lib/credentials';
import { getIntegration } from '@/lib/integrations/registry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { apiKey, accessToken, instanceUrl, organization } = body;

    if (!apiKey && !accessToken) {
      return NextResponse.json(
        { error: 'apiKey or accessToken is required' },
        { status: 400 }
      );
    }

    const integration = getIntegration(id, { apiKey, accessToken, instanceUrl, organization });
    if (!integration) {
      return NextResponse.json(
        { error: `Unknown integration: ${id}` },
        { status: 404 }
      );
    }

    const status = await integration.testConnection();
    if (!status.connected) {
      return NextResponse.json(
        { error: `Connection failed: ${status.error || 'Unknown error'}` },
        { status: 400 }
      );
    }

    setCredentials(id, { apiKey, accessToken, instanceUrl, organization });

    return NextResponse.json({ connected: true, label: status.label });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to connect' },
      { status: 500 }
    );
  }
}
