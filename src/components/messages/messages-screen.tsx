"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send, Phone } from "lucide-react";
import { apiFetch, usePolling } from "@/components/api-client";
import { Avatar, Button, EmptyState, LoadingBlock, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface ConversationItem {
  id: string;
  title: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
  businessId: string | null;
}

interface MessageItem {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaUrl: string | null;
  senderName: string;
  createdAt: string;
  readAt: string | null;
}

export function MessagesScreen() {
  const params = useSearchParams();
  const activeId = params.get("c");
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);

  const convState = usePolling<{ conversations: ConversationItem[] }>("/api/conversations", 8000);
  useEffect(() => {
    if (convState.data) setConversations(convState.data.conversations);
  }, [convState.data]);

  return (
    <div className="flex h-[calc(100dvh-120px)] md:h-[calc(100dvh-56px)]">
      {/* conversation list */}
      <div className={`w-full flex-col border-r border-border md:flex md:w-80 ${activeId ? "hidden" : "flex"}`}>
        <h1 className="border-b border-border px-4 py-3 font-bold">Messages</h1>
        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <LoadingBlock />
          ) : conversations.length === 0 ? (
            <EmptyState
              title="No conversations yet"
              hint="Message businesses directly from their profile to start a conversation."
            />
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages?c=${c.id}`}
                className={`flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-2 ${activeId === c.id ? "bg-surface-2" : ""}`}
              >
                <Avatar src={c.avatarUrl} name={c.title} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-muted">{c.lastMessage ?? "Say hello 👋"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {c.lastMessageAt && <span className="text-[10px] text-muted">{timeAgo(c.lastMessageAt)}</span>}
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
                      {c.unread}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* thread */}
      <div className={`min-w-0 flex-1 ${activeId ? "flex" : "hidden md:flex"}`}>
        {activeId ? (
          <ChatThread conversationId={activeId} />
        ) : (
          <EmptyState title="Select a conversation" hint="Your chats with businesses appear here." />
        )}
      </div>
    </div>
  );
}

function ChatThread({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const state = usePolling<{
    conversation: ConversationItem;
    messages: MessageItem[];
    side: "user" | "business";
  }>(`/api/conversations/${conversationId}/messages`, 4000);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.data?.messages.length]);

  // mark read when opened
  useEffect(() => {
    apiFetch(`/api/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setText("");
      state.reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const conv = state.data?.conversation;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <Link href="/messages" className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden" aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
        {conv ? (
          <>
            <Avatar src={conv.avatarUrl} name={conv.title} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{conv.title}</p>
              <p className="text-xs text-muted">Typically replies within a day</p>
            </div>
            {conv.businessId && (
              <Link href={`/b/${conv.businessId}`} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="View business">
                <Phone size={18} />
              </Link>
            )}
          </>
        ) : (
          <span className="text-sm text-muted">Loading…</span>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {state.loading && !state.data && <LoadingBlock />}
        {state.data?.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                m.fromMe ? "bg-primary text-on-primary rounded-br-md" : "bg-surface-2 text-text rounded-bl-md"
              }`}
            >
              {m.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.mediaUrl} alt="" className="mb-1 max-h-56 rounded-lg object-cover" />
              )}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              <p className={`mt-0.5 text-right text-[10px] ${m.fromMe ? "text-on-primary/70" : "text-muted"}`}>
                {timeAgo(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="max-h-32"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" size="icon" loading={sending} disabled={!text.trim()} aria-label="Send">
          {!sending && <Send size={18} />}
        </Button>
      </form>
    </div>
  );
}
