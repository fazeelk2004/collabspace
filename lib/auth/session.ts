import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./jwt";

/** Read and verify the session JWT from the request cookies (server-side only). */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
});

/** Load the full current user row, or null when unauthenticated. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, image: true, createdAt: true },
  });
});
