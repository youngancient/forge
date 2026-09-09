import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Route-level redirects for UX only. Every mutating API route re-checks
// role/ownership server-side regardless (design.md decision #20) — this
// proxy is not the security boundary, just a nicer experience.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/p/") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname.startsWith("/login");

  if (!isAuthed && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isAuthed && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (pathname.startsWith("/approvals") && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
