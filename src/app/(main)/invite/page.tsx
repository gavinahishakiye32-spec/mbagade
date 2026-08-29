"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Users, Ticket } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, LoadingBlock } from "@/components/ui";
import { apiFetch } from "@/components/api-client";
import { timeAgo } from "@/lib/utils";

interface ReferralInvite {
  id: string;
  type: string;
  invitedEmail: string | null;
  status: "pending" | "completed" | "expired";
  completedAt: string | null;
  createdAt: string;
}

interface ReferralsData {
  code: string;
  invites: ReferralInvite[];
}

/**
 * Customer referral program (addendum #17) — personal invite link,
 * tracked signups. Rewards are configured per launch by the team.
 */
export default function InvitePage() {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<ReferralsData>("/api/referrals")
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const createInvite = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/referrals", { method: "POST", body: JSON.stringify({ type: "customer" }) });
      setData(await apiFetch<ReferralsData>("/api/referrals"));
    } catch (e) {
      if (!(e as Error).message.includes("already")) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  const inviteUrl = data ? `${window.location.origin}/register?ref=${data.code}` : "";
  const completedCount = data?.invites.filter((i) => i.status === "completed").length ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Gift size={22} className="text-accent" />
        <h1 className="text-lg font-bold">Invite friends</h1>
      </div>

      {error && <ErrorState message={error} />}
      {!error && !data && <LoadingBlock />}

      {data && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your invite link</p>
            <p className="mt-2 break-all rounded-lg bg-surface-2 px-3 py-2 text-sm">{inviteUrl}</p>
            <Button size="sm" className="mt-3" onClick={() => copy(inviteUrl)}>
              <Copy size={14} /> Copy link
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Ticket size={18} className="mx-auto text-primary" />
              <p className="mt-1 text-xl font-bold">{data.code}</p>
              <p className="text-xs text-muted">Your code</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Users size={18} className="mx-auto text-success" />
              <p className="mt-1 text-xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted">Friends joined</p>
            </div>
          </div>

          {data.invites.length === 0 ? (
            <EmptyState icon={<Gift size={28} />} title="No invites yet" hint="Share your link — when a friend signs up, it's tracked here." />
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invite history</p>
              {data.invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{inv.invitedEmail ?? <span className="font-mono text-xs">{inv.id.slice(-6).toUpperCase()}</span>}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {inv.status === "completed" ? <Badge tone="success">Joined</Badge> : <Badge>Pending</Badge>}
                    <span className="text-xs text-muted">{timeAgo(inv.createdAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" className="w-full" loading={busy} onClick={createInvite}>
            Generate tracked invite
          </Button>

          <p className="text-center text-xs text-muted">
            Rewards for successful invites are announced at launch and vary by city.
          </p>
        </div>
      )}
    </div>
  );
}
