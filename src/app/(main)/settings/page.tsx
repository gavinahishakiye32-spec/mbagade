"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, Trash2, MonitorSmartphone, Building2, Plus } from "lucide-react";
import { apiFetch } from "@/components/api-client";
import { Avatar, Badge, Button, Input, Label, LinkButton, Modal, Textarea, toast } from "@/components/ui";
import { useSession } from "@/components/session-context";

export default function SettingsPage() {
  const router = useRouter();
  const { user, managedBusinesses } = useSession();
  const [dark, setDark] = useState(true);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setDark(!document.documentElement.classList.contains("dark") ? false : true);
    if (user) {
      setName(user.name);
      setBio(user.bio ?? "");
    }
  }, [user]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("bb-theme", next ? "dark" : "light");
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await apiFetch("/api/settings/profile", { method: "PATCH", body: JSON.stringify({ name, bio }) });
      toast("Profile updated");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4">
      <h1 className="text-lg font-bold">Settings</h1>

      {/* profile */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <Avatar src={user?.avatarUrl ?? null} name={user?.name ?? "?"} size={52} />
          <div>
            <p className="font-semibold">{user?.name}</p>
            <p className="text-sm text-muted">@{user?.username} · {user?.email}</p>
            <div className="mt-1 flex gap-1.5">
              {user?.emailVerified && <Badge tone="success">Email verified</Badge>}
              {user?.role === "admin" && <Badge tone="warning">Admin</Badge>}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-name">Display name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label htmlFor="s-bio">Bio</Label>
            <Textarea id="s-bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Tell people about yourself…" />
          </div>
          <Button onClick={saveProfile} loading={savingProfile}>Save profile</Button>
        </div>
      </section>

      {/* businesses */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Building2 size={16} /> Your businesses</h2>
        {managedBusinesses.length === 0 ? (
          <p className="text-sm text-muted">You don&apos;t have a business yet.</p>
        ) : (
          <ul className="space-y-2">
            {managedBusinesses.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Avatar src={b.logoUrl} name={b.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.name} {b.verified && "✓"}</p>
                  <p className="text-xs capitalize text-muted">{b.role}</p>
                </div>
                <LinkButton href={`/dashboard/${b.id}`} size="sm" variant="secondary">Manage</LinkButton>
              </li>
            ))}
          </ul>
        )}
        <LinkButton href="/create-business" size="sm" variant="outline" className="mt-3">
          <Plus size={14} /> Create a business
        </LinkButton>
      </section>

      {/* preferences */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-bold">Preferences</h2>
        <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-xl px-1 py-2 hover:bg-surface-2">
          <span className="flex items-center gap-2 text-sm">{dark ? <Moon size={17} /> : <Sun size={17} />} Appearance</span>
          <span className="text-sm text-muted">{dark ? "Dark" : "Light"}</span>
        </button>
        <a href="/settings/sessions" className="flex w-full items-center justify-between rounded-xl px-1 py-2 hover:bg-surface-2">
          <span className="flex items-center gap-2 text-sm"><MonitorSmartphone size={17} /> Active sessions</span>
          <span className="text-muted">›</span>
        </a>
        <a href="/settings/password" className="flex w-full items-center justify-between rounded-xl px-1 py-2 hover:bg-surface-2">
          <span className="text-sm">Change password</span>
          <span className="text-muted">›</span>
        </a>
      </section>

      {/* danger zone */}
      <section className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="mb-3 text-sm font-bold text-danger">Danger zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={logout}><LogOut size={15} /> Log out</Button>
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}

function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const del = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/settings/account", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}><Trash2 size={15} /> Delete account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete account?">
        <p className="mb-3 text-sm text-muted">
          This deactivates your account, removes you from businesses and revokes all sessions. This cannot be undone.
        </p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' />
        <Button variant="danger" className="mt-3 w-full" disabled={confirmText !== "DELETE"} loading={loading} onClick={del}>
          Permanently delete
        </Button>
      </Modal>
    </>
  );
}
