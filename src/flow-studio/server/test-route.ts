import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isE2E } from './e2e';
import { guarded } from './route';

/** 01 §5.3: these routes exist only when LEVV_E2E=1. Anything else gets the same 404 as a path that was never there. */
export const testOnly = (handler: (request: NextRequest) => Promise<NextResponse>) =>
  guarded<Record<string, never>>(async (request) => (isE2E() ? handler(request) : new NextResponse(null, { status: 404 })));
