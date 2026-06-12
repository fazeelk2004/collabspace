import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireBoardAccess, PermissionError } from "@/lib/permissions";
import { BoardView } from "@/components/board/board-view";

export const metadata = { title: "Board" };

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { boardId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const { membership } = await requireBoardAccess(session.userId, boardId);
    return <BoardView boardId={boardId} role={membership.role} currentUserId={session.userId} />;
  } catch (e) {
    if (e instanceof PermissionError) notFound();
    throw e;
  }
}
