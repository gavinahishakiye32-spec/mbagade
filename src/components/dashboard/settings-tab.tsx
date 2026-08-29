"use client";

import { useEffect, useState } from "react";
import { useApi, apiFetch } from "@/components/api-client";
import { Button, Input, Label, LoadingBlock, Select, Textarea, Toggle, toast } from "@/components/ui";
import { BUSINESS_CATEGORIES } from "@/config/categories";
import { CURRENCIES } from "@/config/constants";

interface BusinessSettings {
  business: {
    id: string;
    name: string;
    username: string;
    description: string;
    category: string;
    city: string | null;
    country: string | null;
    phone: string | null;
    whatsapp: string | null;
    website: string | null;
    currency: string;
    allowCalls: boolean;
    allowOrders: boolean;
  };
}

export function SettingsTab({ businessId }: { businessId: string }) {
  const state = useApi<BusinessSettings>(`/api/businesses/${businessId}`);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [allowCalls, setAllowCalls] = useState(true);
  const [allowOrders, setAllowOrders] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const b = state.data?.business;
    if (b && !loaded) {
      setName(b.name);
      setDescription(b.description ?? "");
      setCategory(b.category);
      setCity(b.city ?? "");
      setCountry(b.country ?? "");
      setPhone(b.phone ?? "");
      setWhatsapp(b.whatsapp ?? "");
      setWebsite(b.website ?? "");
      setCurrency(b.currency);
      setAllowCalls(b.allowCalls);
      setAllowOrders(b.allowOrders);
      setLoaded(true);
    }
  }, [state.data, loaded]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description,
          category,
          city: city || undefined,
          country: country || undefined,
          phone: phone || undefined,
          whatsapp: whatsapp || undefined,
          website: website || undefined,
          currency,
          allowCalls,
          allowOrders,
        }),
      });
      toast("Business settings saved");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <Label htmlFor="bs-name">Business name</Label>
        <Input id="bs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bs-cat">Category</Label>
          <Select id="bs-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bs-cur">Currency</Label>
          <Select id="bs-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bs-country">Country</Label>
          <Input id="bs-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="bs-city">City</Label>
          <Input id="bs-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bs-phone">Phone</Label>
          <Input id="bs-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        </div>
        <div>
          <Label htmlFor="bs-wa">WhatsApp</Label>
          <Input id="bs-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30} />
        </div>
      </div>
      <div>
        <Label htmlFor="bs-web">Website</Label>
        <Input id="bs-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" maxLength={200} />
      </div>
      <div>
        <Label htmlFor="bs-desc">Description</Label>
        <Textarea id="bs-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </div>

      <Toggle
        checked={allowCalls}
        onChange={setAllowCalls}
        label="Allow voice & video calls from customers"
      />
      <Toggle
        checked={allowOrders}
        onChange={setAllowOrders}
        label="Accept product orders"
      />

      <Button loading={saving} onClick={save}>Save changes</Button>
    </div>
  );
}
