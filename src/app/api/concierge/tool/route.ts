import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Reserved server-side tool bridge for the future Realtime provider (bookings, catalogue
 * search over a database). Every Stage 1 tool is a browser-side UI action executed by
 * src/concierge/tools/executeTool.ts, so this endpoint is a documented seam, not a dependency.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'CONCIERGE_TOOLS_OFFLINE',
        message: 'Server-side concierge tools are not enabled in Stage 1.',
        see: 'CONCIERGE_ARCHITECTURE.md#seam',
      },
    },
    { status: 503 },
  );
}
