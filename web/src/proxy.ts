import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only. The app layout verifies the session with GET /api/me.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("toki_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/app/:path*" };
