import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import type { FlowStore } from '../data/repos';
import { serviceStore, userStore } from '../data/select-store';
import type { Permission } from '../model/runtime';
import { serverClock, type Clock } from './clock';
import { ApiError, errorResponse, invalid, notSignedIn } from './errors';
import { requirePermission, type Actor } from './permissions';
import { currentActor } from './session';

export interface RouteContext<P> { params: P }

async function readBody<B>(request: NextRequest, schema: ZodType<B, ZodTypeDef, unknown>): Promise<B> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw invalid('The body must be JSON.');
  }
  return schema.parse(raw);
}

const issueText = (error: ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');

/** One place that turns anything thrown into `{ error: { code, message } }` (01 §5). */
export function guarded<P>(handler: (request: NextRequest, context: RouteContext<P>) => Promise<NextResponse>) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      if (error instanceof ZodError) return errorResponse(invalid(issueText(error)));
      console.error('Flow Studio route failed', error);
      return errorResponse(new ApiError(500, 'INTERNAL', 'Something went wrong.'));
    }
  };
}

export interface SignedInScope<P, B> {
  request: NextRequest;
  params: P;
  body: B;
  actor: Actor;
  store: FlowStore;
  clock: Clock;
  /** For writes a GET must make without the caller's CSRF token (decision 2). */
  service(): Promise<FlowStore>;
}

export interface SignedInOptions<B> {
  permission?: Permission;
  permissionMessage?: string;
  body?: ZodType<B, ZodTypeDef, unknown>;
}

/** A route for a signed-in user: checks who they are, then what they may do, then the body. */
export function signedIn<P = Record<string, never>, B = undefined>(
  options: SignedInOptions<B>,
  handler: (scope: SignedInScope<P, B>) => Promise<NextResponse>,
) {
  return guarded<P>(async (request, { params }) => {
    const actor = await currentActor(request);
    if (!actor) throw notSignedIn();
    if (options.permission) requirePermission(actor, options.permission, options.permissionMessage);
    const body = options.body ? await readBody(request, options.body) : (undefined as B);
    return handler({
      request,
      params,
      body,
      actor,
      store: await userStore(request),
      clock: serverClock,
      service: () => serviceStore(request),
    });
  });
}

export const json = (data: unknown, status = 200): NextResponse => NextResponse.json(data, { status });
export const noContent = (): NextResponse => new NextResponse(null, { status: 204 });
export { readBody };
