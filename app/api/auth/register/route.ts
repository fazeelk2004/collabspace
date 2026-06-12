import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/jwt";
import { registerSchema } from "@/lib/validations";
import { withErrorHandling, parseBody, enforceRateLimit, clientIp, ApiError } from "@/lib/api-utils";

export const POST = withErrorHandling(async (req: NextRequest) => {
  await enforceRateLimit(`register:${clientIp(req)}`, "auth");
  const { name, email, password } = await parseBody(req, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError("An account with this email already exists", 409);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
    },
    select: { id: true, email: true, name: true },
  });

  const token = await signSession({ userId: user.id, email: user.email, name: user.name });
  const res = NextResponse.json({ user }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
