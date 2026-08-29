"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Eye } from "lucide-react";
import { apiFetch, usePolling } from "@/components/api-client";
import { Avatar, Button, LoadingBlock, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { useSession } from "@/components/session-context";

interface LiveDetail {
  live: {
    id: string;
    title: string;
    embedUrl: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    viewersCount: number;
    businessId: string;
  };
  business: { name: string; username: string; logoUrl: string | null; verified: boolean };
}

interface ChatMessage {
  id: string;
  user: { name: string; username: string; avatarUrl: string | null };
  text: string;
  createdAt: string;
}

export default function LiveWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useSession();
  const state = usePolling<LiveDetail>(`/api/live/${id}`, 15000);
  const chat = usePolling<{ messages: ChatMessage[] }>(`/api/live/${id}/messages`, 4000);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState<number | null>(null);
  const chatBottom = useRef<HTMLDivElement>(null);

  // viewer heartbeat
  useEffect(() => {
    let stop = false;
    const beat = async () => {
      try {
        const d = await apiFetch<{ viewers: number }>(`/api/live/${id}/heartbeat`, { method: "POST" });
        if (!stop) setViewers(d.viewers);
      } catch { /* ignore */ }
    };
    beat();
    const t = setInterval(beat, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.data?.messages.length]);

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error || !state.data) {
    return <p className="py-16 text-center text-sm text-muted">This stream is unavailable.</p>;
  }

  const { live, business } = state.data;

  const sendChat = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/live/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) });
      setText("");
      chat.reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-0 py-0 md:px-4 md:py-4">
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        {/* player */}
        <div>
          <div className="relative aspect-video w-full bg-black">
            <iframe src={live.embedUrl} title={live.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="min-w-0 truncate font-bold">{live.title}</h1>
              {live.status === "live" ? (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-danger px-2 py-0.5 text-[10px] font-bold uppercase text-white">● Live</span>
              ) : (
                <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Ended</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <Link href={`/b/${business.username}`} className="flex items-center gap-2 hover:opacity-80">
                <Avatar src={business.logoUrl} name={business.name} size={32} />
                <span className="text-sm font-semibold">{business.name}</span>
                {business.verified && <span className="text-primary">✓</span>}
              </Link>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Eye size={14} /> {viewers ?? live.viewersCount} watching</span>
            </div>
            <p className="mt-1 text-xs text-muted">Started {timeAgo(live.startedAt)}</p>
          </div>
        </div>

        {/* chat */}
        <aside className="flex h-[60dvh] flex-col border-t border-border md:h-auto md:border-l md:border-t-0 md:pl-4">
          <h2 className="border-b border-border py-2.5 text-sm font-bold">Live chat</h2>
          <div className="flex-1 space-y-3 overflow-y-auto py-3 pr-1">
            {(chat.data?.messages ?? []).map((m) => (
              <div key={m.id} className="flex gap-2">
                <Avatar src={m.user.avatarUrl} name={m.user.name} size={26} />
                <p className="text-xs leading-relaxed">
                  <Link href={`/u/${m.user.username}`} className="font-bold hover:underline">{m.user.name}</Link>{" "}
                  <span className="text-muted">{m.text}</span>
                </p>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>
          {user ? (
            <form
              className="flex items-end gap-2 border-t border-border py-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" maxLength={500} />
              <Button type="submit" size="icon" loading={sending} disabled={!text.trim()} aria-label="Send">
                {!sending && <Send size={16} />}
              </Button>
            </form>
          ) : (
            <p className="border-t border-border py-3 text-center text-xs text-muted">
              <Link href="/login" className="font-semibold text-primary">Log in</Link> to join the chat
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
