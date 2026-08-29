"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useApi } from "@/components/api-client";
import { EmptyState, LoadingBlock, LinkButton } from "@/components/ui";
import { formatCount } from "@/lib/utils";
import type { PostView } from "@/types";

export default function SavedPage() {
  const state = useApi<{ posts: PostView[] }>("/api/feed?tab=saved");
  const [posts, setPosts] = useState<PostView[] | null>(null);
  if (state.data && posts === null) setPosts(state.data.posts);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="mb-4 text-lg font-bold">Saved</h1>
      {state.loading && posts === null ? (
        <LoadingBlock />
      ) : !posts || posts.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={36} />}
          title="Nothing saved yet"
          hint="Tap the bookmark icon on any post to keep it here."
          action={<LinkButton href="/" size="sm" className="mt-2">Browse feed</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((p) => (
            <Link key={p.id} href={`/p/${p.id}`} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2">
              {p.thumbnailUrl || (p.type !== "text" && p.mediaUrls[0]) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl ?? p.mediaUrls[0]} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              ) : (
                <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted">{p.caption.slice(0, 60)}</span>
              )}
              <span className="absolute bottom-1 left-1.5 text-[11px] font-semibold text-white drop-shadow">♥ {formatCount(p.counts.likes)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
