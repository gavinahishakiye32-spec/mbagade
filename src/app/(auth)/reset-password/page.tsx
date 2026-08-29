"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Label, LoadingBlock } from "@/components/ui";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm text-danger">Missing reset token. Use the link from your email.</p>
        <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">Password updated. All other sessions were logged out.</p>
        <Link href="/login" className="font-semibold text-primary hover:underline">Log in with your new password</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="pw">New password</Label>
        <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="pw2">Confirm password</Label>
        <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ResetForm />
    </Suspense>
  );
}
