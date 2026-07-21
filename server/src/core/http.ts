// Error handling for async Express 4 routes.
//
// Express 4 does not catch rejected promises from async handlers: an
// unhandled rejection escapes the request (which then hangs) and, on
// Node 20+, can terminate the process. Every async route is wrapped in
// `ah()` so failures become clean HTTP responses instead.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route handler so rejections reach the error middleware. */
export function ah(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Prisma error codes we can translate into meaningful status codes.
const PRISMA_STATUS: Record<string, { status: number; message: string }> = {
  P2025: { status: 404, message: 'Not found' },
  P2002: { status: 409, message: 'That already exists' },
  P2003: { status: 400, message: 'Related record does not exist' },
};

/** Terminal error middleware. Must be registered after all routes. */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Malformed JSON body from express.json() — a client mistake, not ours.
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  const known = err?.code ? PRISMA_STATUS[err.code] : undefined;
  const status = known?.status ?? 500;

  if (status >= 500) {
    console.error('[error]', err?.message ?? err);
  }

  if (res.headersSent) return;
  res.status(status).json({
    error: known?.message ?? 'Something went wrong on our end. Please try again.',
  });
}

/** 404 for unmatched API routes, so the client gets JSON rather than HTML. */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Endpoint not found' });
}
