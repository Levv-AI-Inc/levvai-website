import { NextResponse } from 'next/server';

/** 01 §5: errors are `{ error: { code, message } }` with the exact user-facing message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorResponse = (error: ApiError): NextResponse =>
  NextResponse.json({ error: { code: error.code, message: error.message, ...error.details } }, { status: error.status });

export const notFound = (message = 'This doesn’t exist.'): ApiError => new ApiError(404, 'NOT_FOUND', message);
export const notSignedIn = (): ApiError => new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
export const forbidden = (message = 'You don’t have permission to do this.'): ApiError => new ApiError(403, 'FORBIDDEN', message);
export const invalid = (message: string): ApiError => new ApiError(400, 'INVALID_REQUEST', message);
