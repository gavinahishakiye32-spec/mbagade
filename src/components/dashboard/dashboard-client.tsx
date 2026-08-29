"use client";

import { useState } from "react";
import {
  BarChart3,
  FileVideo,
  Package,
  ShoppingBag,
  Megaphone,
  BadgeCheck,
  Users,
  Settings as SettingsIcon,
  Tag,
} from "lucide-react";
import { useApi } from "@/components/api-client";
import { LoadingBlock, ErrorState, LinkButton } from "@/components/ui";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { ContentTab } from "@/components/dashboard/content-tab";
import { ProductsTab } from "@/components/dashboard/products-tab";
import { OrdersTab } from "@/components/dashboard/orders-tab";
import { AdsTab } from "@/components/dashboard/ads-tab";
import { GrowthTab } from "@/components/dashboard/growth-tab";
import { TeamTab } from "@/components/dashboard/team-tab";
import { SettingsTab } from "@/components/dashboard/settings-tab";
import { OffersTab } from "@/components/dashboard/offers-tab";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "content", label: "Content", icon: FileVideo },
  { key: "products", label: "Products", icon: Package },
  { key: "offers", label: "Offers", icon: Tag },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "ads", label: "Advertising", icon: Megaphone },
  { key: "growth", label: "Grow", icon: BadgeCheck },
  { key: "team", label: "Team", icon: Users },
  { key: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function DashboardClient({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const state = useApi<{ business: { id: string; name: string; username: string; logoUrl: string | null; verified: boolean; currency: string } }>(
    `/api/businesses/${businessId}`
  );

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Business not found"} />;

  const business = state.data.business;

  return (
    <div className="px-4 py-4">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{business.name}</h1>
          <p className="text-xs text-muted">Business dashboard</p>
        </div>
        <LinkButton href={`/b/${business.username}`} size="sm" variant="outline">View public page</LinkButton>
        <LinkButton href="/create" size="sm">+ New post</LinkButton>
      </div>

      {/* tabs */}
      <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {!canManage && tab !== "overview" ? (
        <p className="py-10 text-center text-sm text-muted">Your role doesn&apos;t allow this section.</p>
      ) : (
        <>
          {tab === "overview" && <OverviewTab businessId={businessId} />}
          {tab === "content" && <ContentTab businessId={businessId} />}
          {tab === "products" && <ProductsTab businessId={businessId} currency={business.currency} />}
          {tab === "offers" && <OffersTab businessId={businessId} />}
          {tab === "orders" && <OrdersTab businessId={businessId} />}
          {tab === "ads" && <AdsTab businessId={businessId} />}
          {tab === "growth" && <GrowthTab businessId={businessId} />}
          {tab === "team" && <TeamTab businessId={businessId} />}
          {tab === "settings" && <SettingsTab businessId={businessId} />}
        </>
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

export function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1.5 flex items-center gap-2 text-muted">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}

export function MiniChart({ points, color = "var(--primary)" }: { points: { date: string; value: number }[]; color?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 100;
  const h = 32;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p.value / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function useDashboardSummary(businessId: string) {
  return useApi<{
    totals: Record<string, number>;
    series: { views: { date: string; value: number }[]; contactClicks: { date: string; value: number }[]; profileVisits: { date: string; value: number }[]; followers: { date: string; value: number }[] };
    topPosts: { id: string; caption: string; views: number; likes: number; comments: number; saves: number }[];
  }>(`/api/dashboard?businessId=${businessId}&days=30`);
}
