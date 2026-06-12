import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { createLabelSchema } from "@/lib/validations";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);
  const labels = await prisma.label.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return json({ labels });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "MEMBER");
  const { name, color } = await parseBody(req, createLabelSchema);

  const existing = await prisma.label.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) throw new ApiError("A label with this name already exists", 409);

  const label = await prisma.label.create({ data: { workspaceId, name, color } });
  return json({ label }, 201);
});
