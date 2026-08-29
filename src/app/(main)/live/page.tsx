"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { apiFetch } from "@/components/api-client";
import { Avatar, Badge, Button, EmptyState, LoadingBlock, Modal, Input, Label, Select, toast } from "@/components/ui";
import { useSession } from "@/components/session-context";

interface LiveItem {
  id: string;
  title: string;
  embedUrl: string;
  viewersCount: number;
  startedAt: string;
  business: { id: string; name: string; username: string; logoUrl: string | null; verified: boolean };
}

const EMBED_HELP = "Paste a live stream URL from YouTube, Facebook, Twitch, Vimeo or Rumble.";

export default function LivePage() {
  const { managedBusinesses } = useSession();
  const [items, setItems] = useState<LiveItem[] | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [starting, setStarting] = useState(false);

  const load = () =>
    apiFetch<{ streams: LiveItem[] }>("/api/live")
      .then((d) => setItems(d.streams))
      .catch(() => setItems([]));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (managedBusinesses.length > 0 && !businessId) setBusinessId(managedBusinesses[0].id);
  }, [managedBusinesses, businessId]);

  const goLive = async () => {
    setStarting(true);
    try {
      const d = await apiFetch<{ id: string }>("/api/live", {
        method: "POST",
        body: JSON.stringify({ businessId, title, embedUrl }),
      });
      toast("You're live! 🎥");
      window.location.href = `/live/${d.id}`;
    } catch (e) {
      toast((e as Error).message, "error");
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold"><Radio size={20} className="text-danger" /> Live now</h1>
        {managedBusinesses.length > 0 && (
          <Button size="sm" onClick={() => setStartOpen(true)}>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger pulse-ring" /> Go live
          </Button>
        )}
      </div>

      {items === null ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Radio size={36} />}
          title="No one is live right now"
          hint="Live streams from businesses appear here in real time."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((s) => (
            <Link key={s.id} href={`/live/${s.id}`} className="group overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg">
              <div className="relative aspect-video bg-black">
                <iframe src={s.embedUrl} title={s.title} className="pointer-events-none h-full w-full object-cover opacity-80" allowFullScreen />
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-danger px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  ● Live
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-3">
                <Avatar src={s.business.logoUrl} name={s.business.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold group-hover:text-primary">{s.title}</p>
                  <p className="truncate text-xs text-muted">{s.business.name}</p>
                </div>
                <Badge>{s.viewersCount} 👁</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Start a live stream">
        <div className="space-y-4">
          <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">{EMBED_HELP}</p>
          <div>
            <Label htmlFor="lv-biz">Stream as</Label>
            <Select id="lv-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {managedBusinesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="lv-title">Title</Label>
            <Input id="lv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Q&A and product showcase" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="lv-url">Stream embed URL</Label>
            <Input id="lv-url" value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </div>
          <Button className="w-full" loading={starting} disabled={!title.trim() || !embedUrl.trim()} onClick={goLive}>
            Start streaming
          </Button>
        </div>
      </Modal>
    </div>
  );
}
