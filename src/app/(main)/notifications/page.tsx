"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, UserPlus, ShoppingBag, BadgeCheck, Radio, PhoneCall, Bell } from "lucide-react";
import { useApi } from "@/components/api-client";
import { Avatar, Button, EmptyState, LoadingBlock } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  like: <Heart size={16} className="fill-danger text-danger" />,
  comment: <MessageCircle size={16} className="text-primary" />,
  follow: <UserPlus size={16} className="text-success" />,
  order: <ShoppingBag size={16} className="text-accent" />,
  review: <span className="text-accent text-sm">★</span>,
  verification: <BadgeCheck size={16} className="text-primary" />,
  live: <Radio size={16} className="text-danger" />,
  call: <PhoneCall size={16} className="text-success" />,
  system: <Bell size={16} className="text-muted" />,
};

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  actor?: { name: string; avatarUrl: string | null } | null;
}

export default function NotificationsPage() {
  const state = useApi<{ notifications: NotificationItem[]; unread: number }>("/api/notifications");
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  if (state.data && items === null) setItems(state.data.notifications);

  const markAll = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    state.reload();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Notifications</h1>
        {(items?.some((n) => !n.readAt) || (state.data?.unread ?? 0) > 0) && (
          <Button variant="ghost" size="sm" onClick={markAll}>Mark all read</Button>
        )}
      </div>

      {state.loading && items === null ? (
        <LoadingBlock />
      ) : state.error ? (
        <EmptyState title="Could not load notifications" hint={state.error} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={<Bell size={36} />} title="No notifications yet" hint="Likes, comments, follows and orders will show up here." />
      ) : (
        <div className="space-y-1">
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.url ?? "#"}
              className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2 ${!n.readAt ? "bg-primary/5" : ""}`}
            >
              {n.actor ? (
                <Avatar src={n.actor.avatarUrl} name={n.actor.name} size={40} />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">{ICONS[n.type] ?? ICONS.system}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{n.title}</strong>
                  {n.body && <span className="text-muted"> {n.body}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
