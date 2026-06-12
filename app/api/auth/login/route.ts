import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/jwt";
import { loginSchema } from "@/lib/validations";
import { withErrorHandling, parseBody, enforceRateLimit, clientIp, ApiError } from "@/lib/api-utils";

export const POST = withErrorHandling(async (req: NextRequest) => {
  await enforceRateLimit(`login:${clientIp(req)}`, "auth");
  const { email, password } = await parseBody(req, loginSchema);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Same error for unknown email and wrong password — no account enumeration.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError("Invalid email or password", 401);
  }

  const token = await signSession({ userId: user.id, email: user.email, name: user.name });
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, image: user.image },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
