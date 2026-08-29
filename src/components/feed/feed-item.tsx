"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Play,
  Volume2,
  VolumeX,
  Flag,
  Music2,
} from "lucide-react";
import type { PostView } from "@/types";
import { apiFetch } from "@/components/api-client";
import { Avatar, Button, Modal, Spinner, Textarea, toast } from "@/components/ui";
import { formatCount, timeAgo } from "@/lib/utils";
import { useSession } from "@/components/session-context";

function authorProfileHref(post: PostView): string {
  return post.author.kind === "user" ? `/u/${post.author.username}` : `/b/${post.author.username}`;
}

function authorAvatarUrl(post: PostView): string | null {
  return post.author.kind === "user" ? post.author.avatarUrl : post.author.logoUrl;
}

function authorName(post: PostView): string {
  return post.author.name;
}

function authorVerified(post: PostView): boolean {
  return post.author.kind === "business" ? post.author.verified : false;
}


/* ---------------- Post actions rail ---------------- */

function ActionRail({ post, onOpenComments }: { post: PostView; onOpenComments: () => void }) {
  const { user } = useSession();
  const [liked, setLiked] = useState(post.viewer.liked);
  const [likes, setLikes] = useState(post.counts.likes);
  const [saved, setSaved] = useState(post.viewer.saved);
  const [saves, setSaves] = useState(post.counts.saves);
  const [shares, setShares] = useState(post.counts.shares);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");

  const requireAuth = (fn: () => void) => {
    if (!user) {
      toast("Log in to interact", "error");
      return;
    }
    fn();
  };

  const toggleLike = () =>
    requireAuth(async () => {
      setLiked(!liked);
      setLikes((n) => n + (liked ? -1 : 1));
      try {
        await apiFetch(`/api/posts/${post.id}/like`, { method: "POST" });
      } catch {
        setLiked(liked);
        setLikes(post.counts.likes);
      }
    });

  const toggleSave = () =>
    requireAuth(async () => {
      setSaved(!saved);
      setSaves((n) => n + (saved ? -1 : 1));
      try {
        await apiFetch(`/api/posts/${post.id}/save`, { method: "POST" });
      } catch {
        setSaved(saved);
      }
    });

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: authorName(post), text: post.caption.slice(0, 80), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
      setShares((n) => n + 1);
      apiFetch(`/api/posts/${post.id}/share`, { method: "POST" }).catch(() => {});
    } catch {
      /* user cancelled share */
    }
  };

  const submitReport = async () => {
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: post.id, reason: reason || "other", details: "" }),
      });
      toast("Report submitted. Thank you.");
      setReportOpen(false);
      setReason("");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button onClick={toggleLike} className="flex flex-col items-center gap-0.5 text-white" aria-label="Like">
        <Heart size={28} className={liked ? "fill-danger text-danger scale-110 transition-transform" : "drop-shadow"} />
        <span className="text-xs font-semibold drop-shadow">{formatCount(likes)}</span>
      </button>
      <button onClick={onOpenComments} className="flex flex-col items-center gap-0.5 text-white" aria-label="Comments">
        <MessageCircle size={27} className="drop-shadow" />
        <span className="text-xs font-semibold drop-shadow">{formatCount(post.counts.comments)}</span>
      </button>
      <button onClick={toggleSave} className="flex flex-col items-center gap-0.5 text-white" aria-label="Save">
        <Bookmark size={26} className={saved ? "fill-accent text-accent" : "drop-shadow"} />
        <span className="text-xs font-semibold drop-shadow">{formatCount(saves)}</span>
      </button>
      <button onClick={share} className="flex flex-col items-center gap-0.5 text-white" aria-label="Share">
        <Share2 size={25} className="drop-shadow" />
        <span className="text-xs font-semibold drop-shadow">{formatCount(shares)}</span>
      </button>
      <button onClick={() => requireAuth(() => setReportOpen(true))} className="text-white/80 hover:text-white mt-1" aria-label="Report">
        <Flag size={20} className="drop-shadow" />
      </button>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report post">
        <div className="space-y-3">
          <p className="text-sm text-muted">Why are you reporting this post?</p>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Spam, scam, inappropriate content…" maxLength={500} />
          <Button className="w-full" variant="danger" onClick={submitReport}>Submit report</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Comments panel ---------------- */

interface CommentView {
  id: string;
  body: string;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
  createdAt: string;
  replyCount: number;
}

function CommentsPanel({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ comments: CommentView[] }>(`/api/posts/${postId}/comments`)
      .then((d) => setComments(d.comments))
      .catch(() => setComments([]));
  }, [open, postId]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const d = await apiFetch<{ comment: CommentView }>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setComments((c) => [...(c ?? []), d.comment]);
      setBody("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Comments`}>
      <div className="max-h-[50vh] space-y-4 overflow-y-auto">
        {comments === null && <Spinner className="mx-auto my-8" />}
        {comments?.length === 0 && <p className="py-6 text-center text-sm text-muted">No comments yet. Be the first!</p>}
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar src={c.author.avatarUrl} name={c.author.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">{c.author.name}</Link>{" "}
                <span className="text-muted">{c.body}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted">{timeAgo(c.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {user ? (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          />
          <Button onClick={send} loading={sending} disabled={!body.trim()}>Post</Button>
        </div>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted">
          <Link href="/login" className="text-primary font-semibold">Log in</Link> to comment
        </p>
      )}
    </Modal>
  );
}

/* ---------------- Media renderer ---------------- */

function PostMedia({ post, active, muted, onToggleMute }: { post: PostView; active: boolean; muted: boolean; onToggleMute: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      v.currentTime = 0;
      setPlaying(false);
    }
  }, [active]);

  const isVideo = post.type === "video" && post.mediaUrls[0];

  if (isVideo) {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          ref={videoRef}
          src={post.mediaUrls[0]}
          poster={post.thumbnailUrl ?? undefined}
          loop
          muted={muted}
          playsInline
          preload={active ? "auto" : "none"}
          className="h-full w-full object-contain"
          onClick={() => {
            const v = videoRef.current!;
            if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
          }}
        />
        {!playing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Play size={56} className="text-white/80 drop-shadow-lg" fill="white" />
          </div>
        )}
        <button
          onClick={onToggleMute}
          className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    );
  }

  if (post.mediaUrls.length > 0) {
    return (
      <div className="h-full w-full overflow-y-auto snap-y snap-mandatory">
        {post.mediaUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="h-full w-full snap-start object-cover" loading={i === 0 ? "eager" : "lazy"} />
        ))}
      </div>
    );
  }

  // Text-only post
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-surface to-accent/20 p-10">
      <p className="whitespace-pre-wrap text-center text-xl font-semibold leading-relaxed">{post.caption}</p>
    </div>
  );
}

/* ---------------- Follow button ---------------- */

function FollowButton({ post }: { post: PostView }) {
  const { user } = useSession();
  const [following, setFollowing] = useState(post.viewer.following);

  if (!user || (post.author.kind === "user" && user.username === post.author.username)) return null;

  const toggle = async () => {
    setFollowing((f) => !f);
    try {
      const url =
        post.author.kind === "user"
          ? `/api/users/${post.author.username}/follow`
          : `/api/businesses/${post.author.id}/follow`;
      const d = await apiFetch<{ following: boolean }>(url, { method: "POST" });
      setFollowing(d.following);
    } catch {
      setFollowing((f) => !f);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`ml-auto rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        following
          ? "border border-white/60 text-white hover:bg-white/10"
          : "bg-white text-black hover:bg-white/90"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

/* ---------------- Feed item ---------------- */

export function FeedItem({ post, active }: { post: PostView; active: boolean }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [muted, setMuted] = useState(true);

  return (
    <section className="feed-item relative h-[calc(100dvh-56px)] w-full overflow-hidden bg-black md:h-[calc(100dvh-56px)]" aria-label={`Post by ${authorName(post)}`}>
      <PostMedia post={post} active={active} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

      {/* gradient overlays */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent" />

      {/* business info + caption */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-6 pr-16 text-white">
        <div className="mb-2 flex items-center gap-2.5">
          <Link href={authorProfileHref(post)} className="shrink-0">
            <Avatar src={authorAvatarUrl(post)} name={authorName(post)} size={38} />
          </Link>
          <div className="min-w-0">
            <Link href={authorProfileHref(post)} className="flex items-center gap-1.5 font-bold leading-tight hover:underline">
              <span className="truncate">{authorName(post)}</span>
              {authorVerified(post) && <span className="text-primary-strong">✓</span>}
            </Link>
            <p className="truncate text-xs text-white/70">
              {post.city ? `${post.city}, ` : ""}{post.country ?? ""} · {timeAgo(post.createdAt)}
            </p>
          </div>
          <FollowButton post={post} />
        </div>

        {post.isSponsored && (
          <span className="mb-1.5 inline-block rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            Sponsored{post.sponsoredLabel ? ` · ${post.sponsoredLabel}` : ""}
          </span>
        )}

        {post.caption && post.type !== "text" && (
          <p className="line-clamp-2-ellipsis max-w-xl whitespace-pre-wrap text-sm text-white/90">{post.caption}</p>
        )}
        {post.hashtags.length > 0 && (
          <p className="mt-1 truncate text-xs font-medium text-primary-strong">
            {post.hashtags.map((t) => `#${t}`).join(" ")}
          </p>
        )}

        {post.sound && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-white/90">
            <Music2 size={14} />
            <span className="truncate">{post.sound.title}</span>
            {post.sound.artist && <span className="text-white/60">· {post.sound.artist}</span>}
          </div>
        )}

        {/* product tags */}
        {post.products.length > 0 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {post.products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-black/55 py-1.5 pl-1.5 pr-3 backdrop-blur transition-transform active:scale-95"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-xs">🛍</span>
                )}
                <span className="text-left">
                  <span className="block max-w-[120px] truncate text-xs font-semibold">{p.name}</span>
                  <span className="block text-xs text-accent">${(p.priceCents / 100).toFixed(2)} {p.currency}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* action rail */}
      <div className="absolute bottom-24 right-2.5">
        <ActionRail post={post} onOpenComments={() => setCommentsOpen(true)} />
      </div>

      <CommentsPanel postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </section>
  );
}
