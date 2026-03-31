import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/board", "/upload", "/users", "/usage", "/module"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  // UX-only redirect hint. This cookie is client-set and is NOT a security boundary.
  // Real authorization is enforced in Convex queries/mutations.
  const hasSession = request.cookies.get("__session_hint")?.value === "1";
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("signin", "1");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/board/:path*", "/upload/:path*", "/users/:path*", "/usage/:path*", "/module/:path*"],
};
