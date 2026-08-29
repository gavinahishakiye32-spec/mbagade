"use client";

import Link from "next/link";
import { Eye, UserPlus, DollarSign, MousePointerClick, Building2, Tag, MessageCircle, Phone } from "lucide-react";
import { StatCard, MiniChart, useDashboardSummary } from "@/components/dashboard/dashboard-client";
import { LoadingBlock, ErrorState } from "@/components/ui";
import { formatCount } from "@/lib/utils";

export function OverviewTab({ businessId }: { businessId: string }) {
  const state = useDashboardSummary(businessId);

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Failed to load analytics"} onRetry={state.reload} />;

  const t = state.data.totals;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Eye size={14} />} label="Post views" value={formatCount(t.views ?? 0)} />
        <StatCard icon={<UserPlus size={14} />} label="Followers" value={formatCount(t.followers ?? 0)} />
        <StatCard icon={<Building2 size={14} />} label="Profile visits" value={formatCount(t.profileVisits ?? 0)} />
        <StatCard icon={<DollarSign size={14} />} label="Revenue" value={`$${((t.revenueCents ?? 0) / 100).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<MousePointerClick size={14} />} label="Contact clicks" value={formatCount(t.contactClicks ?? 0)} />
        <StatCard icon={<Tag size={14} />} label="Offer clicks" value={formatCount(t.offerClicks ?? 0)} />
        <StatCard icon={<MessageCircle size={14} />} label="Message clicks" value={formatCount(t.messageClicks ?? 0)} />
        <StatCard icon={<Phone size={14} />} label="Call clicks" value={formatCount(t.callClicks ?? 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Views · 30 days</p>
          <MiniChart points={state.data.series.views} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Followers · 30 days</p>
          <MiniChart points={state.data.series.followers} color="var(--success)" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MousePointerClick size={12} /> Contact clicks</p>
          <MiniChart points={state.data.series.contactClicks} color="var(--accent)" />
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold">Top posts</h2>
        {state.data.topPosts.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">No published posts yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {state.data.topPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0 truncate text-sm">{p.caption || "(media post)"}</span>
                  <span className="shrink-0 text-xs text-muted">{formatCount(p.views)} views · ♥ {formatCount(p.likes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
