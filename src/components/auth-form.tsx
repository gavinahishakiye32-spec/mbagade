"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Label } from "@/components/ui";

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured on this server yet.",
  facebook_not_configured: "Facebook sign-in is not configured on this server yet.",
  oauth_state_mismatch: "Sign-in session expired. Please try again.",
  oauth_failed: "The provider rejected the sign-in. Please try again.",
  account_suspended: "This account has been suspended. Contact support.",
};

type AccessMode = "public" | "early_access" | "invite_only" | "private";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/";
  const oauthError = params.get("error");
  const refFromUrl = params.get("ref") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [configLoaded, setConfigLoaded] = useState(mode === "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? (OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again.") : null
  );

  // Access-mode awareness (addendum #2/#3): registration UI adapts to the
  // platform's launch phase without any redeploy.
  useEffect(() => {
    if (mode !== "register") return;
    fetch("/api/platform/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAccessMode(d.data.accessMode);
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            password,
            city: city.trim() || undefined,
            country: country.trim() || undefined,
            referralCode: referralCode.trim() || undefined,
          }),
        });
        router.replace(nextUrl);
        router.refresh();
      } else {
        await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        router.replace(nextUrl);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  if (mode === "register" && !configLoaded) {
    return <div className="py-6 text-center text-sm text-muted">Loading…</div>;
  }

  if (mode === "register" && accessMode === "private") {
    return (
      <div>
        <h1 className="mb-1 text-xl font-bold">Registration closed</h1>
        <p className="mt-2 text-sm text-muted">
          BuyBuy is not open for new sign-ups right now. Join the waitlist and we&apos;ll let you know the moment your city opens.
        </p>
        <Link href="/waitlist" className="mt-4 inline-block w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-on-primary hover:bg-primary-strong">
          Join the waitlist
        </Link>
        <p className="mt-5 text-center text-sm text-muted">
          Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mb-5 text-sm text-muted">
        {mode === "login" ? "Log in to continue growing your business." : "Free forever for buyers and businesses."}
      </p>

      {mode === "register" && accessMode === "early_access" && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-xs font-medium">
          🚀 Early access: you&apos;re signing up before the public launch. Founding accounts may receive special badges.
        </div>
      )}

      <div className="mb-4 space-y-2">
        <a href={`/api/auth/oauth/google?next=${encodeURIComponent(nextUrl)}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Continue with Google
        </a>
        <a href={`/api/auth/oauth/facebook?next=${encodeURIComponent(nextUrl)}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"/></svg>
          Continue with Facebook
        </a>
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amara Okafor" required minLength={2} maxLength={80} autoComplete="name" />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "login" && (
            <Link href="/forgot-password" className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          )}
        </div>

        {mode === "register" && (
          <>
            <div>
              <Label htmlFor="referralCode">Invite code {accessMode === "invite_only" ? "(required)" : "(optional)"}</Label>
              <Input id="referralCode" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="e.g. K7M2PQXW" required={accessMode === "invite_only"} maxLength={12} className="font-mono uppercase" />
              {refFromUrl && <p className="mt-1 text-xs text-success">✓ Invite code applied from your link</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lagos" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Nigeria" maxLength={80} />
              </div>
            </div>
          </>
        )}

        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {mode === "login" ? "Log in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {mode === "login" ? (
          <>New to BuyBuy? <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link></>
        )}
      </p>
    </div>
  );
}
