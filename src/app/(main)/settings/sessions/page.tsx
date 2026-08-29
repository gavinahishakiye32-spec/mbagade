"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, apiFetch } from "@/components/api-client";
import { Button, LoadingBlock, EmptyState } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface SessionItem {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

export default function SessionsPage() {
  const router = useRouter();
  const state = useApi<{ sessions: SessionItem[] }>("/api/settings/sessions");
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (id: string | null) => {
    setBusy(id ?? "all");
    try {
      await apiFetch("/api/settings/sessions", {
        method: "DELETE",
        body: JSON.stringify(id ? { sessionId: id } : {}),
      });
      if (!id) {
        router.push("/login");
      } else {
        state.reload();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Active sessions</h1>
        {state.data && state.data.sessions.length > 1 && (
          <Button variant="danger" size="sm" loading={busy === "all"} onClick={() => revoke(null)}>
            Log out everywhere
          </Button>
        )}
      </div>

      {state.loading ? (
        <LoadingBlock />
      ) : !state.data || state.data.sessions.length === 0 ? (
        <EmptyState title="No active sessions" />
      ) : (
        <ul className="space-y-2">
          {state.data.sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {s.userAgent || "Unknown device"} {s.current && <span className="ml-1 text-xs font-bold text-success">· this device</span>}
                </p>
                <p className="text-xs text-muted">{s.ip} · started {timeAgo(s.createdAt)} · active {timeAgo(s.lastActiveAt)}</p>
              </div>
              {!s.current && (
                <Button variant="outline" size="sm" loading={busy === s.id} onClick={() => revoke(s.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
