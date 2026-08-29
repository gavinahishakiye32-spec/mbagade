"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostView } from "@/types";
import { apiFetch } from "@/components/api-client";
import { FeedItem } from "@/components/feed/feed-item";
import { EmptyState, ErrorState, LinkButton, LoadingBlock } from "@/components/ui";
import { useSession } from "@/components/session-context";

const TABS = [
  { key: "for-you", label: "For You" },
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
  { key: "nearby", label: "Nearby" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface FeedResponse {
  posts: PostView[];
  nextCursor: string | null;
}

export function FeedScreen() {
  const { user } = useSession();
  const [tab, setTab] = useState<TabKey>("for-you");
  const [posts, setPosts] = useState<PostView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (tabKey: TabKey, cursorStr: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ tab: tabKey, limit: "8" });
        if (cursorStr) params.set("cursor", cursorStr);
        if (user) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
            );
            params.set("lat", String(pos.coords.latitude));
            params.set("lng", String(pos.coords.longitude));
          } catch {
            /* location unavailable — fine */
          }
        }
        const d = await apiFetch<FeedResponse>(`/api/feed?${params}`);
        setPosts((prev) => (cursorStr ? [...prev, ...d.posts] : d.posts));
        setCursor(d.nextCursor);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
    load(tab, null);
  }, [tab, load]);

  // infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel || loading || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) load(tab, cursor);
      },
      { root: el, rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [cursor, loading, tab, load]);

  // track active item for video autoplay
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
    <div>
      {/* tabs */}
      <div className="sticky top-14 z-30 flex justify-center gap-1 border-b border-border bg-surface/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!user && (
        <div className="border-b border-border bg-surface-2/60 px-4 py-3 text-center text-sm">
          <span className="text-muted">Discover businesses worldwide. </span>
          <LinkButton href="/register" size="sm">Join BuyBuy</LinkButton>
        </div>
      )}

      {error && posts.length === 0 ? (
        <ErrorState message={error} onRetry={() => load(tab, null)} />
      ) : loading && posts.length === 0 ? (
        <LoadingBlock label="Loading feed…" />
      ) : posts.length === 0 ? (
        <EmptyState
          title={tab === "following" ? "Follow people & businesses to see them here" : "Nothing here yet"}
          hint={
            tab === "following"
              ? "Content from creators and businesses you follow will appear in this tab."
              : "Be the first — create a business or start posting as a creator."
          }
          action={
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <LinkButton href="/discover" size="sm">Discover businesses</LinkButton>
              <LinkButton href="/create" size="sm" variant="outline">Create a post</LinkButton>
            </div>
          }
        />
      ) : (
        <div ref={scrollerRef} className="feed-scroller h-[calc(100dvh-108px)] overflow-y-auto md:h-[calc(100dvh-104px)]">
          {posts.map((post, i) => (
            <div data-feed-index={i} key={`${post.id}-${i}`}>
              <FeedItem post={post} active={i === activeIndex} />
            </div>
          ))}
          <div ref={sentinelRef} className="flex justify-center py-8 text-muted">
            {loading && cursor ? "Loading more…" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
