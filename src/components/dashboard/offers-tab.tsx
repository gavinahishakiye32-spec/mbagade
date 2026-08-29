"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Badge, Button, EmptyState, Input, Label, LoadingBlock, Modal, Select, Textarea, toast } from "@/components/ui";
import type { OfferView } from "@/types";

const AVAILABILITY_TONE: Record<OfferView["availability"], "success" | "warning" | "default" | "primary"> = {
  active: "success",
  scheduled: "primary",
  paused: "warning",
  expired: "default",
  draft: "default",
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OffersTab({ businessId }: { businessId: string }) {
  const state = useApi<{ offers: OfferView[] }>(`/api/offers/manage?businessId=${businessId}`);
  const products = useApi<{ items: { id: string; name: string }[] }>(`/api/products?businessId=${businessId}&limit=100`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OfferView | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [terms, setTerms] = useState("");
  const [productId, setProductId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setDiscountLabel(""); setTerms(""); setProductId("");
    setStartsAt(toDatetimeLocal(new Date().toISOString()));
    setEndsAt(toDatetimeLocal(new Date(Date.now() + 7 * 86400000).toISOString()));
    setFile(null); setPreview(null);
    setOpen(true);
  };

  const openEdit = (o: OfferView) => {
    setEditing(o);
    setTitle(o.title);
    setDescription(o.description);
    setDiscountLabel(o.discountLabel);
    setTerms(o.terms);
    setProductId(o.productId ?? "");
    setStartsAt(toDatetimeLocal(o.startsAt));
    setEndsAt(toDatetimeLocal(o.endsAt));
    setFile(null); setPreview(o.imageUrl);
    setOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !discountLabel.trim() || !startsAt || !endsAt) {
      toast("Title, discount label and dates are required", "error");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast("End date must be after start date", "error");
      return;
    }
    setSaving(true);
    try {
      let mediaKeys: string[] | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "offers");
        mediaKeys = [(await apiFetch<{ key: string }>("/api/media/upload", { method: "POST", body: form })).key];
      }
      const body = JSON.stringify({
        title,
        description,
        discountLabel,
        terms,
        productId: productId || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        ...(mediaKeys ? { mediaKeys } : {}),
      });
      if (editing) {
        await apiFetch(`/api/offers/${editing.id}?businessId=${businessId}`, { method: "PATCH", body });
        toast("Offer updated");
      } else {
        await apiFetch(`/api/offers/manage?businessId=${businessId}`, { method: "POST", body });
        toast("Offer created");
      }
      setOpen(false);
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (o: OfferView, status: "active" | "paused") => {
    try {
      await apiFetch(`/api/offers/${o.id}?businessId=${businessId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const remove = async (o: OfferView) => {
    if (!window.confirm(`Delete offer "${o.title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/offers/${o.id}?businessId=${businessId}`, { method: "DELETE" });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus size={15} /> New offer</Button>
      </div>

      {!state.data || state.data.offers.length === 0 ? (
        <EmptyState title="No offers yet" hint="Promotions give customers a reason to buy now — and appear in the public Offers tab." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {state.data.offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{o.title}</p>
                  <Badge tone={AVAILABILITY_TONE[o.availability]}>{o.availability}</Badge>
                </div>
                <p className="text-xs font-semibold text-accent">{o.discountLabel}</p>
                <p className="text-xs text-muted">
                  {new Date(o.startsAt).toLocaleDateString()} → {new Date(o.endsAt).toLocaleDateString()}
                  {" · "}
                  {o.clicksCount} clicks
                </p>
              </div>
              {o.status === "active" ? (
                <Button variant="secondary" size="sm" onClick={() => setStatus(o, "paused")}>Pause</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setStatus(o, "active")}>Activate</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => openEdit(o)}>Edit</Button>
              <Button variant="danger" size="sm" onClick={() => remove(o)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit offer" : "New offer"} wide>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="of-title">Title *</Label>
              <Input id="of-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Weekend flash sale" />
            </div>
            <div>
              <Label htmlFor="of-discount">Discount label *</Label>
              <Input id="of-discount" value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} maxLength={40} placeholder="-20% or Buy 1 Get 1" />
            </div>
          </div>
          <div>
            <Label htmlFor="of-desc">Description</Label>
            <Textarea id="of-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="of-start">Starts *</Label>
              <Input id="of-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="of-end">Ends *</Label>
              <Input id="of-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="of-product">Linked product (optional)</Label>
            <Select id="of-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">None — offer applies to the business</option>
              {(products.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="of-terms">Terms & conditions</Label>
            <Textarea id="of-terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} placeholder="While stocks last." />
          </div>
          <div>
            <Label>Cover image (optional)</Label>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-28 w-full max-w-xs rounded-xl object-cover" />
            ) : (
              <label className="flex h-16 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary">
                Tap to upload a cover image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
                }} />
              </label>
            )}
          </div>
          <Button className="w-full" loading={saving} onClick={save}>{editing ? "Save changes" : "Create offer"}</Button>
        </div>
      </Modal>
    </div>
  );
}
