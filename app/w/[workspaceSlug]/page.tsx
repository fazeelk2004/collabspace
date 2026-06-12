import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { WorkspaceOverview } from "@/components/analytics/workspace-overview";

export const metadata = { title: "Overview" };

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  return <WorkspaceOverview workspaceId={workspace.id} workspaceName={workspace.name} />;
}
