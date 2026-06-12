import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireChannelAccess, PermissionError } from "@/lib/permissions";
import { ChannelConversation } from "@/components/chat/channel-conversation";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; channelId: string }>;
}) {
  const { channelId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const { channel, membership } = await requireChannelAccess(session.userId, channelId);
    return (
      <ChannelConversation
        channelId={channel.id}
        channelName={channel.name}
        channelType={channel.type}
        role={membership.role}
        currentUserId={session.userId}
      />
    );
  } catch (e) {
    if (e instanceof PermissionError) notFound();
    throw e;
  }
}
