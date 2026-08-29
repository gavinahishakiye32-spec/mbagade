"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/components/api-client";
import { toast } from "@/components/ui";

export function UserFollowButton({ username, initial }: { username: string; initial: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await apiFetch<{ following: boolean }>(`/api/users/${username}/follow`, { method: "POST" });
      setFollowing(d.following);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`shrink-0 rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${
        following ? "border border-border text-text hover:bg-surface-2" : "bg-primary text-on-primary hover:opacity-90"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
