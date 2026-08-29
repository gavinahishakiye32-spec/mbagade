"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi, apiFetch } from "@/components/api-client";
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, toast } from "@/components/ui";
import { formatCount, timeAgo } from "@/lib/utils";

interface PostRow {
  id: string;
  type: string;
  caption: string;
  thumbnailUrl: string | null;
  status: string;
  counts: { views: number; likes: number; comments: number };
  createdAt: string;
}

export function ContentTab({ businessId }: { businessId: string }) {
  const state = useApi<{ items: PostRow[] }>(`/api/posts?businessId=${businessId}&limit=50`);
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/posts/${id}`, { method: "DELETE" });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDeleting(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  const posts = state.data?.items ?? [];

  if (posts.length === 0) {
    return <EmptyState title="No posts yet" hint="Publish your first video or photo post to start reaching customers." />;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {posts.map((p) => (
        <li key={p.id} className="flex items-center gap-3 p-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-xs text-muted">{p.type === "video" ? "▶" : "🖼"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.caption || "(media post)"}</p>
            <p className="text-xs text-muted">
              {formatCount(p.counts.views)} views · ♥ {formatCount(p.counts.likes)} · 💬 {formatCount(p.counts.comments)} · {timeAgo(p.createdAt)}
            </p>
          </div>
          {p.status !== "published" && (
            <Badge tone={p.status === "under_review" ? "warning" : "danger"}>{p.status.replace("_", " ")}</Badge>
          )}
          <Link href={`/p/${p.id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">View</Link>
          <Button variant="ghost" size="sm" loading={deleting === p.id} onClick={() => remove(p.id)}>Delete</Button>
        </li>
      ))}
    </ul>
  );
}
