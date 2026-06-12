import { ChatLayoutShell } from "@/components/chat/chat-layout-shell";

export const metadata = { title: "Chat" };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatLayoutShell>{children}</ChatLayoutShell>;
}
