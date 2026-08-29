"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Badge, Button, EmptyState, ErrorState, Input, Label, LoadingBlock, Modal, Select, toast } from "@/components/ui";
import { AD_CPM_CENTS } from "@/config/constants";

interface AdRow {
  id: string;
  type: string;
  title: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  impressionsGoal: number;
  impressions: number;
  clicks: number;
  durationDays: number;
  endsAt: string;
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "primary"> = {
  draft: "default",
  pending_payment: "warning",
  pending_review: "warning",
  active: "success",
  completed: "primary",
  rejected: "danger",
  cancelled: "default",
};

export function AdsTab({ businessId }: { businessId: string }) {
  const state = useApi<{ items: AdRow[] }>("/api/ads");
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<{ id: string; caption: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<"boost_post" | "sponsored_business" | "product_promo">("boost_post");
  const [postId, setPostId] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("20");
  const [days, setDays] = useState("7");

  const openModal = async () => {
    setOpen(true);
    try {
      const d = await apiFetch<{ items: { id: string; caption: string }[] }>(`/api/posts?businessId=${businessId}&limit=50`);
      setPosts(d.items);
      if (d.items[0]) setPostId(d.items[0].id);
    } catch {
      setPosts([]);
    }
  };

  const impressions = Math.floor((parseFloat(budget) * 100 * 1000) / AD_CPM_CENTS) || 0;

  const create = async () => {
    if (title.trim().length < 3 || !budget) {
      toast("Add a title and budget", "error");
      return;
    }
    setSaving(true);
    try {
      const d = await apiFetch<{ advertisement: { id: string }; checkoutUrl: string | null; paymentId: string | null }>("/api/ads", {
        method: "POST",
        body: JSON.stringify({
          type,
          postId: type === "boost_post" ? postId : undefined,
          title,
          budgetCents: Math.round(parseFloat(budget) * 100),
          impressionsGoal: Math.max(1000, impressions),
          durationDays: parseInt(days, 10),
        }),
      });
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      // dev provider — confirm payment then the ad enters review
      if (d.paymentId) {
        await apiFetch("/api/payments/confirm-dev", { method: "POST", body: JSON.stringify({ paymentId: d.paymentId }) }).catch(() => {});
      }
      toast("Campaign submitted for review");
      setOpen(false);
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted">CPM ${(AD_CPM_CENTS / 100).toFixed(2)} · pay per 1,000 impressions</p>
        <Button size="sm" onClick={openModal}><Plus size={15} /> New campaign</Button>
      </div>

      {state.loading && !state.data ? (
        <LoadingBlock />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : !state.data || state.data.items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={36} />}
          title="No campaigns yet"
          hint="Boost your best posts to reach thousands of potential customers."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {state.data.items.map((ad) => (
            <li key={ad.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[ad.status] ?? "default"}>{ad.status.replace("_", " ")}</Badge>
                <span className="text-sm font-semibold">{ad.title}</span>
                <span className="ml-auto text-xs text-muted">{ad.durationDays} days</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, ad.impressionsGoal ? (ad.impressions / ad.impressionsGoal) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {ad.impressions.toLocaleString()} / {ad.impressionsGoal.toLocaleString()} impressions · {ad.clicks} clicks · spent ${(ad.spentCents / 100).toFixed(2)} of ${(ad.budgetCents / 100).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New ad campaign">
        <div className="space-y-4">
          <div>
            <Label htmlFor="ad-type">Campaign type</Label>
            <Select id="ad-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="boost_post">Boost a post</option>
              <option value="sponsored_business">Sponsored business</option>
              <option value="product_promo">Product promo</option>
            </Select>
          </div>
          {type === "boost_post" && (
            <div>
              <Label htmlFor="ad-post">Post to boost</Label>
              <Select id="ad-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
                {posts.length === 0 && <option value="">No posts — publish one first</option>}
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>{p.caption.slice(0, 60) || "(media post)"}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="ad-title">Ad title *</Label>
            <Input id="ad-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Grand opening sale!" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ad-budget">Budget ($) *</Label>
              <Input id="ad-budget" type="number" min="10" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ad-days">Duration (days)</Label>
              <Select id="ad-days" value={days} onChange={(e) => setDays(e.target.value)}>
                {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
          </div>
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
            Estimated reach: ~{impressions.toLocaleString()} impressions
          </p>
          <Button className="w-full" loading={saving} onClick={create}>Create campaign</Button>
        </div>
      </Modal>
    </div>
  );
}
