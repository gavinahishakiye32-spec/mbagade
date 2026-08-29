"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Label, Select, Textarea, toast } from "@/components/ui";
import { BUSINESS_CATEGORIES } from "@/config/categories";
import { CURRENCIES } from "@/config/constants";

export default function CreateBusinessPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [creating, setCreating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const aiDescribe = async () => {
    if (!name || !category) {
      toast("Enter a name and category first", "error");
      return;
    }
    setAiLoading(true);
    try {
      const d = await apiFetch<{ description: string }>("/api/ai/business-description", {
        method: "POST",
        body: JSON.stringify({ name, category, city, country }),
      });
      setDescription(d.description);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !category) {
      toast("Name and category are required", "error");
      return;
    }
    setCreating(true);
    try {
      const d = await apiFetch<{ id: string; username: string }>("/api/businesses", {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          country: country || undefined,
          city: city || undefined,
          currency,
          description: description || undefined,
          phone: phone || undefined,
          website: website || undefined,
        }),
      });
      toast("Business created! 🎉");
      router.push(`/b/${d.username}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
          <Building2 size={26} />
        </span>
        <h1 className="text-xl font-bold">Create your business</h1>
        <p className="mt-1 text-sm text-muted">Free forever. Post content, sell products, go live.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <Label htmlFor="cb-name">Business name *</Label>
          <Input id="cb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amara&apos;s Shea Butter" maxLength={80} />
        </div>

        <div>
          <Label htmlFor="cb-cat">Category *</Label>
          <Select id="cb-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose a category…</option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cb-country">Country</Label>
            <Input id="cb-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Nigeria" maxLength={60} />
          </div>
          <div>
            <Label htmlFor="cb-city">City</Label>
            <Input id="cb-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lagos" maxLength={60} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cb-cur">Currency</Label>
            <Select id="cb-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cb-phone">WhatsApp / Phone</Label>
            <Input id="cb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" maxLength={30} />
          </div>
        </div>

        <div>
          <Label htmlFor="cb-web">Website</Label>
          <Input id="cb-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" maxLength={200} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cb-desc">Description</Label>
            <button onClick={aiDescribe} disabled={aiLoading} className="mb-1.5 flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Write with AI
            </button>
          </div>
          <Textarea id="cb-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes your business special?" maxLength={1000} />
        </div>

        <Button size="lg" className="w-full" onClick={submit} loading={creating}>
          Create business
        </Button>
        <p className="text-center text-xs text-muted">
          You can apply for the verified badge later from your dashboard.
        </p>
      </div>
    </div>
  );
}
