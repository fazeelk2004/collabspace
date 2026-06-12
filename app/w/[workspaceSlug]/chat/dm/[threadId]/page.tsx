import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { requireDmAccess, PermissionError } from "@/lib/permissions";
import { DmConversation } from "@/components/chat/dm-conversation";

export default async function DmPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; threadId: string }>;
}) {
  const { threadId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    await requireDmAccess(session.userId, threadId);
  } catch (e) {
    if (e instanceof PermissionError) notFound();
    throw e;
  }

  const other = await prisma.directMessageParticipant.findFirst({
    where: { threadId, userId: { not: session.userId } },
    include: { user: { select: { id: true, name: true, image: true } } },
  });

  return (
    <DmConversation
      threadId={threadId}
      other={other?.user ?? null}
      currentUserId={session.userId}
    />
  );
}
