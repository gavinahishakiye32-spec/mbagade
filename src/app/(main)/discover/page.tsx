"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BUSINESS_CATEGORIES } from "@/config/categories";
import { apiFetch } from "@/components/api-client";
import { Avatar, Badge, EmptyState, Input, LoadingBlock } from "@/components/ui";
import { formatCount } from "@/lib/utils";

interface BusinessCard {
  id: string;
  name: string;
  username: string;
  logoUrl: string | null;
  coverUrl: string | null;
  category: string;
  city: string | null;
  country: string | null;
  verified: boolean;
  followersCount: number;
}

interface DiscoverData {
  businesses: BusinessCard[];
  trendingHashtags: { tag: string; count: number }[];
}

export default function DiscoverPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launchCities, setLaunchCities] = useState<string[]>([]);

  // Launch-city chips (addendum #12/#13): purely config-driven.
  useEffect(() => {
    fetch("/api/platform/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data.launchCities)) setLaunchCities(d.data.launchCities);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      apiFetch<DiscoverData>(`/api/businesses?${params}`)
        .then(setData)
        .catch(() => setData({ businesses: [], trendingHashtags: [] }))
        .finally(() => setLoading(false));
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div className="px-4 py-4">
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search businesses, products…"
          className="pl-10"
          aria-label="Search"
        />
      </div>

      {/* launch cities */}
      {launchCities.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Launching in</p>
          <div className="flex flex-wrap gap-2">
            {launchCities.map((city) => (
              <button
                key={city}
                onClick={() => setQ(q === city ? "" : city)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${q === city ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-text"}`}
              >
                📍 {city}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* category chips */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setCategory("")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${!category ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}
        >
          All
        </button>
        {BUSINESS_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCategory(c.slug)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${category === c.slug ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* trending hashtags */}
      {!q && data && data.trendingHashtags.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold">Trending now</h2>
          <div className="flex flex-wrap gap-2">
            {data.trendingHashtags.map((t) => (
              <span key={t.tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                #{t.tag} · {formatCount(t.count)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* results */}
      {loading ? (
        <LoadingBlock />
      ) : !data || data.businesses.length === 0 ? (
        <EmptyState title="No businesses found" hint="Try a different search or category." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.businesses.map((b) => (
            <Link
              key={b.id}
              href={`/b/${b.username}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg"
            >
              <div className="h-20 bg-gradient-to-r from-primary/40 to-accent/30">
                {b.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="px-4 pb-4">
                <div className="-mt-6 mb-2 flex items-end justify-between">
                  <Avatar src={b.logoUrl} name={b.name} size={48} />
                  {b.verified && <Badge tone="primary">✓ Verified</Badge>}
                </div>
                <p className="truncate font-semibold group-hover:text-primary">{b.name}</p>
                <p className="truncate text-xs text-muted">
                  {b.city ? `${b.city}, ` : ""}{b.country ?? ""} · {formatCount(b.followersCount)} followers
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
