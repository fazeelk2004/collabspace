import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { WorkspaceHub } from "@/components/workspace/workspace-hub";

export const metadata = { title: "Your workspaces" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          _count: { select: { members: true, boards: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const workspaces = memberships.map((m) => ({ ...m.workspace, role: m.role }));

  // First-run onboarding: a single workspace goes straight to the app.
  if (workspaces.length === 1) redirect(`/w/${workspaces[0].slug}`);

  return <WorkspaceHub user={user} workspaces={workspaces} />;
}
