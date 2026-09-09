import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export class ApiAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new ApiAuthError(401, "Unauthorized");
  }
  return session;
}

export async function requireManager(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "MANAGER") {
    throw new ApiAuthError(403, "Manager role required");
  }
  return session;
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
