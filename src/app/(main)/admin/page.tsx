"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Building2,
  BadgeCheck,
  Flag,
  Megaphone,
  ScrollText,
  DollarSign,
  Settings2,
  UserPlus,
  KeyRound,
  ListOrdered,
} from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, Label, LoadingBlock, Select, Textarea, Toggle, toast } from "@/components/ui";
import { formatCount, timeAgo } from "@/lib/utils";
import { BUSINESS_CATEGORIES } from "@/config/categories";

const TABS = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "users", label: "Users", icon: Users },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "verifications", label: "Verifications", icon: BadgeCheck },
  { key: "claims", label: "Claims", icon: KeyRound },
  { key: "onboarding", label: "Onboarding", icon: UserPlus },
  { key: "waitlist", label: "Waitlist", icon: ListOrdered },
  { key: "platform", label: "Platform", icon: Settings2 },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "ads", label: "Ads", icon: Megaphone },
  { key: "audit", label: "Audit log", icon: ScrollText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="px-4 py-4">
      <h1 className="mb-1 text-lg font-bold">Platform administration</h1>
      <p className="mb-4 text-xs text-muted">All actions are recorded in the audit log.</p>

      <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "businesses" && <BusinessesTab />}
      {tab === "verifications" && <VerificationsTab />}
      {tab === "claims" && <ClaimsTab />}
      {tab === "onboarding" && <OnboardingTab />}
      {tab === "waitlist" && <WaitlistTab />}
      {tab === "platform" && <PlatformTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "ads" && <AdsAdmin />}
      {tab === "audit" && <AuditLog />}
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Overview() {
  const state = useApi<{
    users: { total: number; customers: number; businessOwners: number; suspended: number; banned: number; newToday: number };
    businesses: { total: number; verified: number; pendingVerification: number; suspended: number };
    content: { posts: number; underReview: number; openReports: number };
    commerce: { orders: number; paidOrders: number; gmvCents: number; platformFeesCents: number };
    ads: { active: number; pendingReview: number };
    activity: { events7d: number };
  }>("/api/admin/stats");

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Failed"} onRetry={state.reload} />;
  const d = state.data;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold">Users</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total" value={formatCount(d.users.total)} />
          <Stat label="Customers" value={formatCount(d.users.customers)} />
          <Stat label="Business owners" value={formatCount(d.users.businessOwners)} />
          <Stat label="New today" value={formatCount(d.users.newToday)} />
          <Stat label="Suspended" value={formatCount(d.users.suspended)} tone="text-accent" />
          <Stat label="Banned" value={formatCount(d.users.banned)} tone="text-danger" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold">Businesses & content</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Businesses" value={formatCount(d.businesses.total)} />
          <Stat label="Verified" value={formatCount(d.businesses.verified)} tone="text-success" />
          <Stat label="Pending verification" value={formatCount(d.businesses.pendingVerification)} tone="text-accent" />
          <Stat label="Posts" value={formatCount(d.content.posts)} />
          <Stat label="Under review" value={formatCount(d.content.underReview)} tone="text-accent" />
          <Stat label="Open reports" value={formatCount(d.content.openReports)} tone="text-danger" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><DollarSign size={14} /> Commerce</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Orders" value={formatCount(d.commerce.orders)} />
          <Stat label="Paid orders" value={formatCount(d.commerce.paidOrders)} />
          <Stat label="GMV" value={`$${(d.commerce.gmvCents / 100).toFixed(2)}`} />
          <Stat label="Platform fees" value={`$${(d.commerce.platformFeesCents / 100).toFixed(2)}`} tone="text-success" />
          <Stat label="Events (7d)" value={formatCount(d.activity.events7d)} />
        </div>
      </section>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersTab() {
  const [q, setQ] = useState("");
  const state = useApi<{ items: { id: string; name: string; email: string; username: string; role: string; status: string; emailVerified: boolean; foundingCustomer: boolean; createdAt: string }[] }>(
    `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`
  );
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (userId: string, action: string) => {
    setBusy(userId);
    try {
      await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ userId, action }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Input placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" />
      {state.loading && !state.data ? (
        <LoadingBlock />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {(state.data?.items ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar src={null} name={u.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {u.name} <span className="font-normal text-muted">@{u.username}</span>
                </p>
                <p className="truncate text-xs text-muted">{u.email} · joined {timeAgo(u.createdAt)}</p>
              </div>
              <Badge tone={u.role === "admin" ? "warning" : u.role === "business" ? "primary" : "default"}>{u.role}</Badge>
              <Badge tone={u.status === "active" ? "success" : u.status === "banned" ? "danger" : u.status === "suspended" ? "warning" : "default"}>{u.status}</Badge>
              {u.foundingCustomer && <Badge tone="warning">★ Founding</Badge>}
              <div className="flex gap-1.5">
                {u.status === "active" ? (
                  <>
                    <Button variant="outline" size="sm" loading={busy === u.id} onClick={() => act(u.id, "suspend")}>Suspend</Button>
                    <Button variant="danger" size="sm" loading={busy === u.id} onClick={() => act(u.id, "ban")}>Ban</Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" loading={busy === u.id} onClick={() => act(u.id, "activate")}>Activate</Button>
                )}
                {u.role !== "admin" ? (
                  <Button variant="ghost" size="sm" loading={busy === u.id} onClick={() => act(u.id, "make_admin")}>Make admin</Button>
                ) : (
                  <Button variant="ghost" size="sm" loading={busy === u.id} onClick={() => act(u.id, "remove_admin")}>Remove admin</Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === u.id}
                  onClick={() => act(u.id, u.foundingCustomer ? "revoke_founding_customer" : "grant_founding_customer")}
                >
                  {u.foundingCustomer ? "Revoke founding" : "Grant founding"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Businesses ---------------- */

function BusinessesTab() {
  const state = useApi<{ items: { id: string; name: string; username: string; category: string; country: string | null; city: string | null; verification: string; status: string; followersCount: number; founding: boolean; claimStatus: string; createdAt: string }[] }>(
    "/api/admin/businesses"
  );
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (businessId: string, action: string) => {
    setBusy(businessId);
    try {
      await apiFetch("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessId, action }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {(state.data?.items ?? []).map((b) => (
        <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <Link href={`/b/${b.username}`} className="truncate text-sm font-semibold hover:text-primary">{b.name}</Link>
            <p className="truncate text-xs text-muted">
              @{b.username} · {[b.city, b.country].filter(Boolean).join(", ") || "—"} · {formatCount(b.followersCount)} followers
            </p>
          </div>
          <Badge tone={b.verification === "verified" ? "success" : b.verification === "pending" ? "warning" : "default"}>{b.verification}</Badge>
          <Badge tone={b.status === "active" ? "success" : "danger"}>{b.status}</Badge>
          {b.founding && <Badge tone="warning">★ Founding</Badge>}
          {b.claimStatus === "unclaimed" && <Badge tone="primary">Unclaimed</Badge>}
          <div className="flex gap-1.5">
            {b.verification !== "verified" && (
              <Button variant="secondary" size="sm" loading={busy === b.id} onClick={() => act(b.id, "verify")}>Verify</Button>
            )}
            {b.status === "active" ? (
              <Button variant="danger" size="sm" loading={busy === b.id} onClick={() => act(b.id, "suspend")}>Suspend</Button>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === b.id} onClick={() => act(b.id, "activate")}>Activate</Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              loading={busy === b.id}
              onClick={() => act(b.id, b.founding ? "revoke_founding_business" : "grant_founding_business")}
            >
              {b.founding ? "Revoke founding" : "Grant founding"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Verifications ---------------- */

function VerificationsTab() {
  const state = useApi<{ items: { id: string; business: { id: string; name: string; username: string }; registrationNumber: string; note: string; documents: { fileKey: string; label: string }[]; submittedAt: string }[] }>(
    "/api/admin/verifications"
  );
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (requestId: string, decision: "approved" | "rejected") => {
    setBusy(requestId);
    try {
      await apiFetch("/api/admin/verifications", {
        method: "POST",
        body: JSON.stringify({ requestId, decision, reviewNote: decision === "rejected" ? "Documents could not be validated" : "" }),
      });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  const items = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState title="No verification requests" />;

  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/b/${r.business.username}`} className="font-semibold hover:text-primary">{r.business.name}</Link>
            <span className="font-mono text-xs text-muted">{r.registrationNumber}</span>
            <span className="ml-auto text-xs text-muted">{timeAgo(r.submittedAt)}</span>
          </div>
          {r.note && <p className="mt-1.5 text-sm text-muted">{r.note}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {r.documents.map((doc, i) => (
              <a key={i} href={`/api/media/${doc.fileKey}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-primary hover:underline">
                📎 {doc.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy === r.id} onClick={() => review(r.id, "approved")}>Approve</Button>
            <Button variant="danger" size="sm" loading={busy === r.id} onClick={() => review(r.id, "rejected")}>Reject</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Reports ---------------- */

function ReportsTab() {
  const state = useApi<{ items: { id: string; targetType: string; targetId: string; reason: string; details: string; status: string; reporter: string; createdAt: string }[] }>(
    "/api/admin/reports"
  );
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (reportId: string, resolution: string) => {
    setBusy(reportId);
    try {
      await apiFetch("/api/admin/reports", {
        method: "POST",
        body: JSON.stringify({ reportId, decision: resolution === "no_action" ? "dismissed" : "actioned", resolution, note: "" }),
      });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  const items = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState title="No reports" hint="User reports about content will appear here." />;

  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.status === "open" ? "warning" : "default"}>{r.status}</Badge>
            <span className="text-sm font-semibold capitalize">{r.reason.replace(/_/g, " ")}</span>
            <span className="text-xs text-muted">on a {r.targetType}</span>
            <span className="ml-auto text-xs text-muted">by {r.reporter} · {timeAgo(r.createdAt)}</span>
          </div>
          {r.details && <p className="mt-1.5 text-sm text-muted">{r.details}</p>}
          {r.status === "open" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.targetType === "post" && (
                <Link href={`/p/${r.targetId}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">View content</Link>
              )}
              <Button size="sm" variant="danger" loading={busy === r.id} onClick={() => resolve(r.id, "remove_content")}>Remove content</Button>
              <Button size="sm" variant="outline" loading={busy === r.id} onClick={() => resolve(r.id, "warn")}>Warn</Button>
              <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => resolve(r.id, "no_action")}>Dismiss</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Ads moderation ---------------- */

function AdsAdmin() {
  const state = useApi<{ items: { id: string; title: string; businessName?: string; status: string; budgetCents: number; impressionsGoal: number }[] }>("/api/admin/ads");
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (advertisementId: string, action: "approve" | "reject") => {
    setBusy(advertisementId);
    try {
      await apiFetch("/api/admin/ads", { method: "POST", body: JSON.stringify({ advertisementId, action }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  const items = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState title="No ad campaigns" />;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((ad) => (
        <li key={ad.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ad.title}</p>
            <p className="text-xs text-muted">${(ad.budgetCents / 100).toFixed(2)} budget · {ad.impressionsGoal.toLocaleString()} goal</p>
          </div>
          <Badge tone={ad.status === "active" ? "success" : ad.status === "pending_review" ? "warning" : ad.status === "rejected" ? "danger" : "default"}>{ad.status.replace("_", " ")}</Badge>
          {ad.status === "pending_review" && (
            <div className="flex gap-1.5">
              <Button size="sm" loading={busy === ad.id} onClick={() => act(ad.id, "approve")}>Approve</Button>
              <Button variant="danger" size="sm" loading={busy === ad.id} onClick={() => act(ad.id, "reject")}>Reject</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Audit log ---------------- */

function AuditLog() {
  const state = useApi<{ items: { id: string; action: string; targetType: string; targetId: string | null; actor: string; createdAt: string }[] }>("/api/admin/audit-logs");

  if (state.loading && !state.data) return <LoadingBlock />;
  const items = state.data?.items ?? [];
  if (items.length === 0) return <EmptyState title="No audit entries yet" />;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface font-mono text-xs">
      {items.map((l) => (
        <li key={l.id} className="flex flex-wrap gap-2 p-3">
          <span className="text-muted">{new Date(l.createdAt).toLocaleString()}</span>
          <span className="font-bold text-primary">{l.action}</span>
          <span className="text-muted">{l.targetType}{l.targetId ? `:${l.targetId.slice(-6)}` : ""}</span>
          <span className="ml-auto text-muted">by {l.actor}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Claims (addendum #10) ---------------- */

function ClaimsTab() {
  const [status, setStatus] = useState("pending");
  const state = useApi<{ items: { id: string; status: string; note: string; docFileKey: string | null; createdAt: string; user: { id: string; name: string; email: string } | null; business: { id: string; name: string; username: string; city: string | null; country: string | null } | null }[] }>(
    `/api/admin/claims${status ? `?status=${status}` : ""}`
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const resolve = async (claimId: string, decision: "approved" | "rejected") => {
    setBusy(claimId);
    try {
      await apiFetch(`/api/admin/claims?id=${claimId}`, {
        method: "POST",
        body: JSON.stringify({ decision, reviewNote: note }),
      });
      toast(decision === "approved" ? "Claim approved — ownership transferred" : "Claim rejected");
      setNote("");
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {state.loading && !state.data ? (
        <LoadingBlock />
      ) : (state.data?.items ?? []).length === 0 ? (
        <EmptyState icon={<KeyRound size={28} />} title={`No ${status} claims`} hint="Business ownership claims appear here for review." />
      ) : (
        <ul className="space-y-3">
          {(state.data?.items ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/b/${c.business?.username ?? ""}`} className="font-semibold hover:text-primary">{c.business?.name ?? "Unknown business"}</Link>
                {(c.business?.city || c.business?.country) && (
                  <span className="text-xs text-muted">{[c.business.city, c.business.country].filter(Boolean).join(", ")}</span>
                )}
                <Badge tone={c.status === "pending" ? "warning" : c.status === "approved" ? "success" : "danger"}>{c.status}</Badge>
                <span className="ml-auto text-xs text-muted">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm">
                Claimed by <strong>{c.user?.name ?? "unknown"}</strong> <span className="text-muted">({c.user?.email})</span>
              </p>
              {c.note && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{c.note}</p>}
              {c.docFileKey && (
                <a href={`/api/media/${c.docFileKey}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-primary hover:underline">
                  📎 Supporting document
                </a>
              )}
              {c.status === "pending" && (
                <div className="mt-3 space-y-2">
                  <Input placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy === c.id} onClick={() => resolve(c.id, "approved")}>Approve & transfer</Button>
                    <Button variant="danger" size="sm" loading={busy === c.id} onClick={() => resolve(c.id, "rejected")}>Reject</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Assisted onboarding (addendum #9) ---------------- */

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "INR", "BRL", "MXN", "PHP", "IDR"];

function OnboardingTab() {
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string } | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [founding, setFounding] = useState(false);

  const submit = async () => {
    if (!name.trim() || !username.trim() || !category) {
      toast("Name, username and category are required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ id: string; username: string }>("/api/admin/businesses/manual", {
        method: "POST",
        body: JSON.stringify({
          name, username: username.toLowerCase(), category, description,
          country, region, city, address, phone, whatsapp, email, website,
          currency, founding,
        }),
      });
      toast(`Business created — claim link: /b/${res.username}`);
      setCreated(res);
      setName(""); setUsername(""); setCategory(""); setDescription("");
      setCountry(""); setRegion(""); setCity(""); setAddress("");
      setPhone(""); setWhatsapp(""); setEmail(""); setWebsite("");
      setFounding(false);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-xs text-muted">
        Create a complete business profile on behalf of an owner (e.g. a market association batch). The profile is
        published as <strong>unclaimed</strong> — the real owner then visits the page and claims it to take control.
      </div>

      {created && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          ✓ Created <Link href={`/b/${created.username}`} className="font-semibold text-primary hover:underline">/b/{created.username}</Link> — share this link with the owner so they can claim it.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ob-name">Business name *</Label>
          <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <Label htmlFor="ob-username">Username *</Label>
          <Input id="ob-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="mamas_kitchen" maxLength={30} />
        </div>
        <div>
          <Label htmlFor="ob-category">Category *</Label>
          <Select id="ob-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose…</option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ob-currency">Currency</Label>
          <Select id="ob-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="ob-desc">Description</Label>
        <Textarea id="ob-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="ob-country">Country</Label>
          <Input id="ob-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="ob-region">Region / State</Label>
          <Input id="ob-region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="ob-city">City</Label>
          <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
        </div>
      </div>
      <div>
        <Label htmlFor="ob-address">Address</Label>
        <Input id="ob-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ob-phone">Phone</Label>
          <Input id="ob-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        </div>
        <div>
          <Label htmlFor="ob-whatsapp">WhatsApp</Label>
          <Input id="ob-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30} />
        </div>
        <div>
          <Label htmlFor="ob-email">Contact email</Label>
          <Input id="ob-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ob-website">Website</Label>
          <Input id="ob-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" maxLength={300} />
        </div>
      </div>
      <Toggle checked={founding} onChange={setFounding} label="Mark as Founding Business" />
      <Button loading={saving} onClick={submit}>Create business profile</Button>
    </div>
  );
}

/* ---------------- Waitlist (addendum #5/#21) ---------------- */

function WaitlistTab() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("pending");
  const state = useApi<{ items: { id: string; type: string; name: string | null; email: string; phone: string | null; country: string | null; city: string | null; businessName: string | null; category: string | null; status: string; createdAt: string }[] }>(
    `/api/admin/waitlist?${new URLSearchParams({ ...(type ? { type } : {}), ...(status ? { status } : {}) }).toString()}`
  );
  const [busy, setBusy] = useState<string | null>(null);

  const markInvited = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/waitlist?id=${id}`, { method: "POST", body: JSON.stringify({ action: "mark_invited" }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
          <option value="">All types</option>
          <option value="customer">Customers</option>
          <option value="business">Businesses</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="invited">Invited</option>
          <option value="converted">Converted</option>
        </Select>
      </div>

      {state.loading && !state.data ? (
        <LoadingBlock />
      ) : (state.data?.items ?? []).length === 0 ? (
        <EmptyState icon={<ListOrdered size={28} />} title="No waitlist entries" hint="Pre-launch signups from /waitlist appear here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {(state.data?.items ?? []).map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{w.name || w.email}</p>
                <p className="truncate text-xs text-muted">
                  {w.email}
                  {[w.city, w.country].filter(Boolean).length > 0 && ` · ${[w.city, w.country].filter(Boolean).join(", ")}`}
                  {w.businessName && ` · ${w.businessName}`}
                  {" · "}
                  {timeAgo(w.createdAt)}
                </p>
              </div>
              <Badge tone={w.type === "business" ? "primary" : "default"}>{w.type}</Badge>
              <Badge tone={w.status === "invited" ? "success" : "warning"}>{w.status}</Badge>
              {w.status === "waiting" && (
                <Button variant="outline" size="sm" loading={busy === w.id} onClick={() => markInvited(w.id)}>Mark invited</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Platform config (addendum #2/#7/#12) ---------------- */

interface PlatformConfig {
  accessMode: "public" | "early_access" | "invite_only" | "private";
  launchCountries: string[];
  launchCities: string[];
  launchRegions: string[];
  foundingProgram: {
    enabled: boolean;
    businessBadgeText: string;
    customerBadgeText: string;
    autoGrantBusinessUntil: string | null;
    autoGrantCustomerUntil: string | null;
  };
  referralEnabled: boolean;
}

function PlatformTab() {
  const state = useApi<PlatformConfig>("/api/admin/platform-config");
  const [saving, setSaving] = useState(false);

  // local editable copies
  const [accessMode, setAccessMode] = useState<PlatformConfig["accessMode"]>("public");
  const [launchCountries, setLaunchCountries] = useState("");
  const [launchCities, setLaunchCities] = useState("");
  const [foundingEnabled, setFoundingEnabled] = useState(true);
  const [bizUntil, setBizUntil] = useState("");
  const [custUntil, setCustUntil] = useState("");
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  if (state.data && !loaded) {
    setAccessMode(state.data.accessMode);
    setLaunchCountries(state.data.launchCountries.join(", "));
    setLaunchCities(state.data.launchCities.join(", "));
    setFoundingEnabled(state.data.foundingProgram.enabled);
    setBizUntil(state.data.foundingProgram.autoGrantBusinessUntil ? toLocalInput(state.data.foundingProgram.autoGrantBusinessUntil) : "");
    setCustUntil(state.data.foundingProgram.autoGrantCustomerUntil ? toLocalInput(state.data.foundingProgram.autoGrantCustomerUntil) : "");
    setReferralEnabled(state.data.referralEnabled);
    setLoaded(true);
  }

  const save = async () => {
    setSaving(true);
    try {
      const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      await apiFetch("/api/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({
          accessMode,
          launchCountries: list(launchCountries),
          launchCities: list(launchCities),
          referralEnabled,
          foundingProgram: {
            enabled: foundingEnabled,
            autoGrantBusinessUntil: bizUntil ? new Date(bizUntil).toISOString() : null,
            autoGrantCustomerUntil: custUntil ? new Date(custUntil).toISOString() : null,
          },
        }),
      });
      toast("Platform configuration saved");
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;

  return (
    <div className="max-w-2xl space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold">Access mode</h2>
        <Select value={accessMode} onChange={(e) => setAccessMode(e.target.value as PlatformConfig["accessMode"])}>
          <option value="public">Public — anyone can register</option>
          <option value="early_access">Early access — open registration, founding badges active</option>
          <option value="invite_only">Invite only — registration requires a valid invite code</option>
          <option value="private">Private — registration closed (waitlist only)</option>
        </Select>
        <p className="mt-1.5 text-xs text-muted">Changes apply immediately — no redeploy needed.</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold">Launch locations (comma-separated)</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pc-countries">Countries</Label>
            <Input id="pc-countries" value={launchCountries} onChange={(e) => setLaunchCountries(e.target.value)} placeholder="Nigeria, Kenya" />
          </div>
          <div>
            <Label htmlFor="pc-cities">Cities</Label>
            <Input id="pc-cities" value={launchCities} onChange={(e) => setLaunchCities(e.target.value)} placeholder="Lagos, Nairobi" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Founding program</h2>
        <Toggle checked={foundingEnabled} onChange={setFoundingEnabled} label="Founding program enabled" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pc-biz-until">Auto-grant business badge until</Label>
            <Input id="pc-biz-until" type="datetime-local" value={bizUntil} onChange={(e) => setBizUntil(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pc-cust-until">Auto-grant customer badge until</Label>
            <Input id="pc-cust-until" type="datetime-local" value={custUntil} onChange={(e) => setCustUntil(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">Leave empty to disable auto-granting; badges can always be granted manually from the Users/Businesses tabs.</p>
      </section>

      <section>
        <Toggle checked={referralEnabled} onChange={setReferralEnabled} label="Referral program enabled" />
      </section>

      <Button loading={saving} onClick={save}>Save configuration</Button>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
