"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostView } from "@/types";
import { apiFetch } from "@/components/api-client";
import { FeedItem } from "@/components/feed/feed-item";
import { EmptyState, ErrorState, LinkButton, LoadingBlock } from "@/components/ui";

interface FeedResponse {
  items: PostView[];
  nextCursor: string | null;
}

/**
 * Full-screen vertical short-video feed (TikTok-style Reels). Loads video
 * posts from /api/feed?tab=reels with autoplay as the user scrolls.
 */
export function ReelsScreen() {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (cursorStr: string | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tab: "reels", limit: "6" });
      if (cursorStr) params.set("cursor", cursorStr);
      const d = await apiFetch<FeedResponse>(`/api/feed?${params}`);
      setPosts((prev) => (cursorStr ? [...prev, ...d.items] : d.items));
      setCursor(d.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  // infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel || loadingRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) load(cursor);
      },
      { root: el, rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [cursor, loading, load]);

  // track active item for autoplay
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll("[data-feed-index]"));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(Number((entry.target as HTMLElement).dataset.feedIndex));
          }
        }
      },
      { root: el, threshold: [0.6] }
    );
    items.forEach((i) => obs.observe(i));
    return () => obs.disconnect();
  }, [posts]);

  return (
    <div className="h-[calc(100dvh-56px)] w-full overflow-hidden bg-black md:h-[calc(100dvh-56px)]">
      {error && posts.length === 0 ? (
        <ErrorState message={error} onRetry={() => load(null)} />
      ) : loading && posts.length === 0 ? (
        <LoadingBlock label="Loading reels…" />
      ) : posts.length === 0 ? (
        <EmptyState
          title="No reels yet"
          hint="Record a short video with the camera and it'll appear here."
          action={<LinkButton href="/create" size="sm">Create a video</LinkButton>}
        />
      ) : (
        <div ref={scrollerRef} className="feed-scroller h-full w-full overflow-y-auto">
          {posts.map((post, i) => (
            <div data-feed-index={i} key={`${post.id}-${i}`}>
              <FeedItem post={post} active={i === activeIndex} />
            </div>
          ))}
          <div ref={sentinelRef} className="flex justify-center py-8 text-white/60">
            {loading && cursor ? "Loading more…" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
