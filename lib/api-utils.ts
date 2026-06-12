import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import { PermissionError } from "@/lib/permissions";
import { rateLimit, RATE_LIMITS } from "@/lib/redis/rate-limit";
import type { SessionPayload } from "@/lib/auth/jwt";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Require an authenticated session or throw 401. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError("Unauthorized", 401);
  return session;
}

/** Parse + validate a JSON body against a Zod schema. */
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  return schema.parse(json);
}

/** Apply a Redis-backed rate limit; throws 429 when exceeded. */
export async function enforceRateLimit(
  identifier: string,
  kind: keyof typeof RATE_LIMITS = "mutation"
): Promise<void> {
  const result = await rateLimit(`${kind}:${identifier}`, RATE_LIMITS[kind]);
  if (!result.allowed) {
    throw new ApiError(
      `Too many requests. Try again in ${result.resetInSeconds}s`,
      429
    );
  }
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Wrap a route handler with uniform error handling so every endpoint returns
 * consistent JSON errors and logs unexpected failures.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      if (error instanceof ApiError || error instanceof PermissionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("[api] unhandled error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, { status });
}
