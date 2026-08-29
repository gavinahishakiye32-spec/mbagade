"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Avatar, Badge, Button, ErrorState, Input, Label, LoadingBlock, Modal, Select, toast } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { useSession } from "@/components/session-context";

interface MemberRow {
  id: string;
  role: string;
  name: string;
  email: string;
  joinedAt: string;
}

export function TeamTab({ businessId }: { businessId: string }) {
  const state = useApi<{ items: MemberRow[] }>(`/api/businesses/${businessId}/members`);
  const { managedBusinesses } = useSession();
  const isOwner = managedBusinesses.find((b) => b.id === businessId)?.role === "owner";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "editor">("editor");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const invite = async () => {
    if (!email.includes("@")) {
      toast("Enter a valid email", "error");
      return;
    }
    setInviting(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      toast(`Invited ${email}`);
      setOpen(false);
      setEmail("");
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member?")) return;
    setRemoving(memberId);
    try {
      await apiFetch(`/api/businesses/${businessId}/members`, { method: "DELETE", body: JSON.stringify({ memberId }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRemoving(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;

  return (
    <div className="max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted">Managers can edit everything. Editors can create content only.</p>
        {isOwner && (
          <Button size="sm" onClick={() => setOpen(true)}><UserPlus size={15} /> Invite</Button>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {(state.data?.items ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
            <Avatar src={null} name={m.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{m.name}</p>
              <p className="truncate text-xs text-muted">{m.email} · joined {timeAgo(m.joinedAt)}</p>
            </div>
            <Badge tone={m.role === "owner" ? "primary" : m.role === "manager" ? "success" : "default"}>{m.role}</Badge>
            {isOwner && m.role !== "owner" && (
              <Button variant="ghost" size="sm" loading={removing === m.id} onClick={() => removeMember(m.id)}>Remove</Button>
            )}
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite a team member">
        <div className="space-y-4">
          <div>
            <Label htmlFor="tm-email">Their email (must have a BuyBuy account)</Label>
            <Input id="tm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
          </div>
          <div>
            <Label htmlFor="tm-role">Role</Label>
            <Select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as "manager" | "editor")}>
              <option value="editor">Editor — create & manage own content</option>
              <option value="manager">Manager — full business access</option>
            </Select>
          </div>
          <Button className="w-full" loading={inviting} onClick={invite}>Send invite</Button>
        </div>
      </Modal>
    </div>
  );
}
