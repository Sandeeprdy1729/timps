import { NextRequest, NextResponse } from 'next/server';
import { getPlugin } from '@/lib/plugins/registry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const plugin = getPlugin(id, body.config || {});
    if (!plugin) {
      return NextResponse.json(
        { error: `Unknown plugin: ${id}` },
        { status: 404 }
      );
    }

    const result = await plugin.run();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Plugin execution failed' },
      { status: 500 }
    );
  }
}
