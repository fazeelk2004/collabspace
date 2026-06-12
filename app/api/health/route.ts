import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

/** ALB health check endpoint. Verifies DB and Redis connectivity. */
export async function GET() {
  const checks = { db: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {}
  try {
    checks.redis = (await redis.ping()) === "PONG";
  } catch {}

  const healthy = checks.db && checks.redis;
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, uptime: process.uptime() },
    { status: healthy ? 200 : 503 }
  );
}
