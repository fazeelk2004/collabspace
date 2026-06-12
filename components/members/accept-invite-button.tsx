"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, FetchError } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token, slug }: { token: string; slug: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function accept() {
    setLoading(true);
    try {
      await api(`/api/invitations/${token}/accept`, { method: "POST" });
      toast.success("Welcome aboard!");
      router.push(`/w/${slug}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not accept invitation");
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" onClick={accept} loading={loading}>
      Accept invitation
    </Button>
  );
}
