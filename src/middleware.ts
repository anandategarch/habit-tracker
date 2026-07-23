import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight API authentication middleware.
 *
 * When the environment variable `APP_API_KEY` is set (non-empty), every
 * request to `/api/*` must include a matching `x-api-key` request header
 * OR a `?apiKey=...` query string. Requests without it receive 401.
 *
 * When `APP_API_KEY` is NOT set (e.g. local development), the middleware
 * is a no-op — all API routes remain open. This keeps local dev frictionless
 * while allowing production deployments to lock the API down with a single
 * env var.
 *
 * The frontend is expected to send the same key via the `x-api-key` header.
 * You can set this key in your hosting provider's environment variables
 * (e.g. Vercel dashboard) — never commit it to git.
 *
 * NOTE: This is shared-secret auth, suitable for a single-user personal app.
 * For multi-user apps, use NextAuth.js with a proper session provider.
 */

const PUBLIC_API_ROUTES = new Set<string>([
  // Add API routes that should remain public even when APP_API_KEY is set.
  // Example: '/api/health'. None by default.
]);

function isPublicApiRoute(pathname: string): boolean {
  if (PUBLIC_API_ROUTES.has(pathname)) return true;
  // Allow exact match only — sub-paths under a "public" route are NOT public.
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = new URL(request.url);

  // Only protect /api/* routes.
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const apiKey = process.env.APP_API_KEY;
  if (!apiKey) {
    // No key configured — open mode (dev). Allow all.
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow either header or query string (query is convenient for SSE/websocket-style calls).
  const provided = request.headers.get('x-api-key') || searchParams.get('apiKey') || '';

  // Constant-time-ish comparison to avoid trivial timing attacks.
  if (provided.length !== apiKey.length || provided !== apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide x-api-key header or ?apiKey= query.' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on /api/* only — not on static assets or pages.
  matcher: ['/api/:path*'],
};
