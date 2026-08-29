"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tag, MapPin } from "lucide-react";
import { Avatar, Badge, EmptyState, ErrorState, LoadingBlock } from "@/components/ui";
import { apiFetch } from "@/components/api-client";
import { timeAgo } from "@/lib/utils";
import type { OfferView } from "@/types";
import { BUSINESS_CATEGORIES } from "@/config/categories";

/**
 * Promotions discovery (addendum #14/#15) — a reason for customers to open
 * BuyBuy even when they follow nobody: live offers from businesses.
 */
export default function OffersPage() {
  const [offers, setOffers] = useState<OfferView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [city, setCity] = useState<string>("");

  useEffect(() => {
    setOffers(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    apiFetch<{ offers: OfferView[] }>(`/api/offers?${params.toString()}`)
      .then((d) => setOffers(d.offers))
      .catch((e) => setError((e as Error).message));
  }, [category, city]);

  // remember the visitor's last manual location choice (device-independent)
  useEffect(() => {
    const saved = window.localStorage.getItem("bb-city");
    if (saved) setCity(saved);
  }, []);

  const pickCity = (value: string) => {
    setCity(value);
    if (value) window.localStorage.setItem("bb-city", value);
    else window.localStorage.removeItem("bb-city");
  };

  const grouped = useMemo(() => offers ?? [], [offers]);

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-bold">Offers & promotions</h1>
      <p className="mb-4 text-xs text-muted">Live deals from businesses on BuyBuy.</p>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setCategory("")}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${!category ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}
        >
          All
        </button>
        {BUSINESS_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCategory(category === c.slug ? "" : c.slug)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${category === c.slug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <MapPin size={15} className="text-muted" />
        <input
          value={city}
          onChange={(e) => pickCity(e.target.value)}
          placeholder="Filter by city (optional)"
          className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {error && <ErrorState message={error} />}
      {!error && offers === null && <LoadingBlock />}

      {grouped.length === 0 && offers !== null && !error && (
        <EmptyState icon={<Tag size={28} />} title="No active offers right now" hint="Check back soon — businesses post new deals regularly." />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map((o) => (
          <div key={o.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md">
            {o.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.imageUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
            )}
            <div className="flex flex-col p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <Avatar src={o.business.logoUrl} name={o.business.name} size={36} />
              <div className="min-w-0 flex-1">
                <Link href={`/b/${o.business.username}`} className="block truncate text-sm font-semibold hover:underline">
                  {o.business.name}
                </Link>
                {(o.city || o.country) && (
                  <p className="truncate text-xs text-muted">{[o.city, o.country].filter(Boolean).join(", ")}</p>
                )}
              </div>
              {o.business.founding && <Badge tone="warning">★</Badge>}
            </div>
            <p className="text-base font-bold">{o.title}</p>
            <p className="mt-0.5 text-sm font-semibold text-accent">{o.discountLabel}</p>
            {o.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{o.description}</p>}
            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-[11px] text-muted">Ends {timeAgo(o.endsAt)}</span>
              {o.productId ? (
                <Link
                  href={`/products/${o.productId}`}
                  onClick={() => apiFetch(`/api/offers/${o.id}/click`, { method: "POST" }).catch(() => {})}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-primary-strong"
                >
                  View product
                </Link>
              ) : (
                <Link
                  href={`/b/${o.business.username}`}
                  onClick={() => apiFetch(`/api/offers/${o.id}/click`, { method: "POST" }).catch(() => {})}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
                >
                  Visit business
                </Link>
              )}
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
