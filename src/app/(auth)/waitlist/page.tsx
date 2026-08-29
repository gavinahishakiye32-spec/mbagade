"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label, toast } from "@/components/ui";
import { apiFetch } from "@/components/api-client";

/**
 * Public waitlist capture (addendum #5/#21) — for people and businesses in
 * cities BuyBuy has not launched in yet. No login required.
 */
export default function WaitlistPage() {
  const [type, setType] = useState<"customer" | "business">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({
          type,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          ...(type === "business" && businessName.trim() ? { businessName: businessName.trim() } : {}),
        }),
      });
      setDone(true);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Join the waitlist</h1>
        <p className="mt-1 text-sm text-muted">
          BuyBuy is launching city by city. Leave your details and we&apos;ll invite you the moment we open your area.
        </p>
      </div>

      {done ? (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-center">
          <p className="text-sm font-semibold">You&apos;re on the list! 🎉</p>
          <p className="mt-1 text-xs text-muted">We&apos;ll email you when your city opens.</p>
          <Link href="/login" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["customer", "business"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}
              >
                {t === "customer" ? "I'm a buyer" : "I'm a business"}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="wl-name">{type === "business" ? "Your name" : "Full name"}</Label>
            <Input id="wl-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama Mensah" />
          </div>
          {type === "business" && (
            <div>
              <Label htmlFor="wl-biz">Business name</Label>
              <Input id="wl-biz" maxLength={100} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ama's Fabrics" />
            </div>
          )}
          <div>
            <Label htmlFor="wl-email">Email</Label>
            <Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wl-city">City</Label>
              <Input id="wl-city" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Accra" />
            </div>
            <div>
              <Label htmlFor="wl-country">Country</Label>
              <Input id="wl-country" maxLength={60} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Ghana" />
            </div>
          </div>
          <Button type="submit" className="w-full" loading={busy}>Join waitlist</Button>
        </form>
      )}
    </div>
  );
}
