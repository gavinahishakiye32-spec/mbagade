"use client";

import { useState } from "react";
import { BadgeCheck, Upload } from "lucide-react";
import { useApi, apiFetch } from "@/components/api-client";
import { Badge, Button, Input, Label, LoadingBlock, Textarea, toast } from "@/components/ui";

interface VerificationItem {
  id: string;
  businessId: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export function GrowthTab({ businessId }: { businessId: string }) {
  const state = useApi<{ items: VerificationItem[] }>("/api/verification-requests");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [note, setNote] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items = state.data?.items ?? [];
  const latest = items.find((r) => r.businessId === businessId) ?? null;

  const submit = async () => {
    if (!registrationNumber.trim() || !docFile) {
      toast("Registration number and one document are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", docFile);
      form.append("folder", "verification");
      const up = await apiFetch<{ key: string }>("/api/media/upload", { method: "POST", body: form });
      await apiFetch("/api/verification-requests", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          registrationNumber,
          note,
          documents: [{ type: "registration", fileKey: up.key, label: docFile.name.slice(0, 100) }],
        }),
      });
      toast("Verification request submitted");
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;

  const latestStatus = latest?.status;
  const pendingRequest = latest?.status === "pending" ? latest : null;

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${latestStatus === "approved" ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted"}`}>
            <BadgeCheck size={24} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold">Verified badge</h2>
              {latestStatus === "approved" && <Badge tone="success">Verified</Badge>}
              {latestStatus === "pending" && <Badge tone="warning">Under review</Badge>}
              {latestStatus === "rejected" && <Badge tone="danger">Rejected</Badge>}
            </div>
            <p className="text-sm text-muted">
              {latestStatus === "approved"
                ? "Your business is verified. The badge builds trust and boosts discovery."
                : latestStatus === "pending"
                  ? "Our team is reviewing your documents. This usually takes 1–3 days."
                  : latestStatus === "rejected"
                    ? `Your last request was rejected.${latest?.reviewNote ? ` Note: ${latest.reviewNote}` : ""}`
                    : "Prove your business is real with official registration documents."}
            </p>
          </div>
        </div>
      </div>

      {latestStatus !== "approved" && !pendingRequest && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div>
            <Label htmlFor="vf-reg">Business registration number *</Label>
            <Input id="vf-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="RC-1234567 / ABN / EIN…" maxLength={80} />
          </div>
          <div>
            <Label>Registration document * (PDF or image)</Label>
            <label className="flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary">
              <Upload size={16} />
              {docFile ? docFile.name : "Tap to upload"}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div>
            <Label htmlFor="vf-note">Note to reviewers</Label>
            <Textarea id="vf-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Anything that helps us verify faster…" />
          </div>
          <Button loading={submitting} onClick={submit}>Submit for verification</Button>
        </div>
      )}

      {pendingRequest && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
          Request submitted {new Date(pendingRequest.submittedAt).toLocaleDateString()} — under review.
        </p>
      )}
    </div>
  );
}
