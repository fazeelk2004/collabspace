import Link from "next/link";
import { redirect } from "next/navigation";
import { KanbanSquare, MailX, UserX, PartyPopper } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AcceptInviteButton } from "@/components/members/accept-invite-button";

export const metadata = { title: "Workspace invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();

  // Unauthenticated users sign in first, then come back here.
  if (!session) redirect(`/login?from=/invite/${token}`);

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true, slug: true, _count: { select: { members: true } } } },
      invitedBy: { select: { name: true } },
    },
  });

  const invalid =
    !invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date();
  const wrongEmail = invitation && invitation.email !== session.email.toLowerCase();

  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100">
      <AuroraBackground />
      <Link
        href="/"
        className="relative mb-8 flex animate-in fade-in slide-in-from-bottom-3 items-center gap-2.5 text-lg font-semibold text-white duration-500"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <KanbanSquare className="h-5 w-5 text-white" />
        </span>
        CollabSpace
      </Link>
      <Card className="glass-card relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 rounded-2xl text-center duration-500">
        {invalid ? (
          <>
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15">
                <MailX className="h-6 w-6 text-rose-400" />
              </div>
              <CardTitle className="text-white">Invitation not available</CardTitle>
              <CardDescription>
                This invitation is invalid, expired or was already used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full rounded-full border-white/15 bg-white/5 hover:bg-white/10">
                <Link href="/dashboard">Go to your workspaces</Link>
              </Button>
            </CardContent>
          </>
        ) : wrongEmail ? (
          <>
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
                <UserX className="h-6 w-6 text-amber-400" />
              </div>
              <CardTitle className="text-white">Wrong account</CardTitle>
              <CardDescription>
                This invitation was sent to <strong>{invitation.email}</strong>, but you are
                signed in as <strong>{session.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full rounded-full border-white/15 bg-white/5 hover:bg-white/10">
                <Link href={`/login?from=/invite/${token}`}>Switch account</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                <PartyPopper className="h-6 w-6 text-indigo-300" />
              </div>
              <CardTitle className="text-white">
                Join <span className="gradient-text">{invitation.workspace.name}</span>
              </CardTitle>
              <CardDescription>
                {invitation.invitedBy?.name ?? "A teammate"} invited you to join as{" "}
                <span className="font-medium capitalize text-slate-200">
                  {invitation.role.toLowerCase()}
                </span>
                . {invitation.workspace._count.members} member
                {invitation.workspace._count.members === 1 ? "" : "s"} already inside.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptInviteButton token={token} slug={invitation.workspace.slug} />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
