import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  if (!workspace) notFound();

  // Tenant gate: only members may see anything under /w/[slug].
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    select: { role: true },
  });
  if (!membership) notFound();

  const [boards, memberships] = await Promise.all([
    prisma.board.findMany({
      where: {
        workspaceId: workspace.id,
        ...(can.manage(membership.role)
          ? {}
          : { OR: [{ visibility: "WORKSPACE" }, { createdById: user.id }] }),
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <AppShell
      user={user}
      workspace={workspace}
      role={membership.role}
      boards={boards}
      allWorkspaces={memberships.map((m) => m.workspace)}
    >
      {children}
    </AppShell>
  );
}
