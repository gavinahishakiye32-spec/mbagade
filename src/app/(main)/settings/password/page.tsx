"use client";

import { useState } from "react";
import { apiFetch } from "@/components/api-client";
import { Button, Input, Label, toast } from "@/components/ui";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast("New passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/settings/password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      toast("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-lg font-bold">Change password</h1>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <Label htmlFor="cur">Current password</Label>
          <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </div>
        <div>
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="conf">Confirm new password</Label>
          <Input id="conf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" loading={loading} className="w-full">Update password</Button>
      </form>
    </div>
  );
}
