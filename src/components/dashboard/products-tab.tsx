"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Button, EmptyState, Input, Label, LoadingBlock, Modal, Select, Textarea, toast } from "@/components/ui";
import { BUSINESS_CATEGORIES } from "@/config/categories";

interface ProductRow {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  stock: number | null;
  available: boolean;
  imageUrl: string | null;
}

export function ProductsTab({ businessId, currency }: { businessId: string; currency: string }) {
  const state = useApi<{ items: ProductRow[] }>(`/api/products?businessId=${businessId}&limit=100`);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"product" | "service">("product");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const reset = () => {
    setName(""); setPrice(""); setStock(""); setDescription(""); setCategory(""); setFile(null); setPreview(null);
  };

  const save = async () => {
    if (!name.trim() || !price || !category) {
      toast("Name, price and category are required", "error");
      return;
    }
    setSaving(true);
    try {
      let imageKey: string | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "products");
        const up = await apiFetch<{ key: string }>("/api/media/upload", { method: "POST", body: form });
        imageKey = up.key;
      }
      await apiFetch(`/api/products?businessId=${businessId}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          kind,
          currency,
          priceCents: Math.round(parseFloat(price) * 100),
          stock: stock === "" ? null : parseInt(stock, 10),
          description,
          category,
          ...(imageKey ? { imageKeys: [imageKey] } : {}),
        }),
      });
      toast("Product added");
      setOpen(false);
      reset();
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (p: ProductRow) => {
    try {
      await apiFetch(`/api/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ available: !p.available }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Add product</Button>
      </div>

      {!state.data || state.data.items.length === 0 ? (
        <EmptyState title="No products yet" hint="Add products or services so customers can buy directly." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {state.data.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center">🛍</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">
                  ${(p.priceCents / 100).toFixed(2)} {p.currency}
                  {p.stock !== null ? ` · ${p.stock} in stock` : " · unlimited"}
                </p>
              </div>
              <Button variant={p.available ? "secondary" : "outline"} size="sm" onClick={() => toggleAvailability(p)}>
                {p.available ? "Visible" : "Hidden"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add product" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pr-name">Name *</Label>
              <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="pr-kind">Type</Label>
              <Select id="pr-kind" value={kind} onChange={(e) => setKind(e.target.value as "product" | "service")}>
                <option value="product">Physical product</option>
                <option value="service">Service</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pr-price">Price ({currency}) *</Label>
              <Input id="pr-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="19.99" />
            </div>
            <div>
              <Label htmlFor="pr-stock">Stock</Label>
              <Input id="pr-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder={kind === "service" ? "unlimited" : "25"} disabled={kind === "service"} />
            </div>
          </div>
          <div>
            <Label htmlFor="pr-cat">Category *</Label>
            <Select id="pr-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose…</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pr-desc">Description</Label>
            <Textarea id="pr-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <Label>Photo</Label>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-28 w-28 rounded-xl object-cover" />
            ) : (
              <label className="flex h-20 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary">
                Tap to upload a photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
                }} />
              </label>
            )}
          </div>
          <Button className="w-full" loading={saving} onClick={save}>Save product</Button>
        </div>
      </Modal>
    </div>
  );
}
