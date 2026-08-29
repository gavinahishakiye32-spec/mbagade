"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Reset your password</h1>
      <p className="mb-5 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>

      {sent ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
          </p>
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
          <p className="text-center text-sm text-muted">
            Remembered it? <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
          </p>
        </form>
      )}
    </div>
  );
}
