import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has("access_token") || request.cookies.has("refresh_token");

  if (publicPaths.includes(pathname) && hasToken) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  if (pathname.startsWith("/chat") && !hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/login", "/register"],
};
