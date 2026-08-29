"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Star, MapPin, Globe, Share2, Tag } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Input, Label, LinkButton, Modal, Textarea, toast } from "@/components/ui";
import { apiFetch } from "@/components/api-client";
import { formatCount, timeAgo, mediaUrl } from "@/lib/utils";
import type { OfferView, PostView } from "@/types";

interface BusinessData {
  id: string;
  name: string;
  username: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string;
  category: string;
  city: string | null;
  country: string | null;
  verified: boolean;
  website: string | null;
  phone: string | null;
  rating: number;
  ratingCount: number;
  followersCount: number;
  createdAt: string;
  currency: string;
  founding: boolean;
  claimable: boolean;
}

interface ProductCard {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  inStock: boolean;
}

interface ReviewItem {
  id: string;
  rating: number;
  text: string;
  author: { name: string; username: string };
  createdAt: string;
}

export function BusinessProfile({
  business,
  viewer,
  initialPosts,
  products,
  reviews,
}: {
  business: BusinessData;
  viewer: { following: boolean; canManage: boolean; loggedIn: boolean };
  initialPosts: PostView[];
  products: ProductCard[];
  reviews: ReviewItem[];
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(viewer.following);
  const [followers, setFollowers] = useState(business.followersCount);
  const [tab, setTab] = useState<"posts" | "offers" | "products" | "reviews" | "about">("posts");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [calling, setCalling] = useState(false);
  const [offers, setOffers] = useState<OfferView[] | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimNote, setClaimNote] = useState("");
  const [claimDoc, setClaimDoc] = useState<File | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    if (tab !== "offers" || offers) return;
    apiFetch<{ offers: OfferView[] }>(`/api/offers?businessId=${business.id}`)
      .then((d) => setOffers(d.offers))
      .catch(() => setOffers([]));
  }, [tab, offers, business.id]);

  const requireAuth = (fn: () => void) => {
    if (!viewer.loggedIn) {
      toast("Log in to continue", "error");
      return;
    }
    fn();
  };

  const toggleFollow = () =>
    requireAuth(async () => {
      setFollowing(!following);
      setFollowers((n) => n + (following ? -1 : 1));
      try {
        await apiFetch(`/api/businesses/${business.id}/follow`, { method: "POST" });
      } catch {
        setFollowing(following);
        setFollowers(business.followersCount);
      }
    });

  const startChat = async () => {
    try {
      const d = await apiFetch<{ conversationId: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ businessId: business.id }),
      });
      router.push(`/messages?c=${d.conversationId}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const startCall = async (type: "voice" | "video") => {
    setCalling(true);
    try {
      const d = await apiFetch<{ callId: string }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({ businessId: business.id, type }),
      });
      router.push(`/calls/${d.callId}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setCalling(false);
    }
  };

  const submitReview = async () => {
    try {
      await apiFetch(`/api/businesses/${business.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, text: reviewText }),
      });
      toast("Review posted!");
      setReviewOpen(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/b/${business.username}`;
    if (navigator.share) {
      navigator.share({ title: business.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    }
  };

  const submitClaim = async () => {
    setClaimBusy(true);
    try {
      let docFileKey: string | undefined;
      if (claimDoc) {
        const form = new FormData();
        form.append("file", claimDoc);
        form.append("folder", "claims");
        docFileKey = (await apiFetch<{ key: string }>("/api/media/upload", { method: "POST", body: form })).key;
      }
      await apiFetch(`/api/businesses/${business.id}/claim`, {
        method: "POST",
        body: JSON.stringify({ note: claimNote, ...(docFileKey ? { docFileKey } : {}) }),
      });
      toast("Claim submitted — we'll review it shortly.");
      setClaimOpen(false);
      setClaimNote("");
      setClaimDoc(null);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setClaimBusy(false);
    }
  };

  const getOffer = (offerId: string) => {
    apiFetch(`/api/offers/${offerId}/click`, { method: "POST" }).catch(() => {});
  };

  return (
    <div className="pb-8">
      {/* cover */}
      <div className="relative h-36 bg-gradient-to-r from-primary/50 to-accent/30 sm:h-48">
        {business.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(business.coverUrl)!} alt="" className="h-full w-full object-cover" />
        )}
        <button onClick={share} aria-label="Share profile" className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur">
          <Share2 size={17} />
        </button>
      </div>

      <div className="px-4">
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <Avatar src={business.logoUrl} name={business.name} size={80} />
          <div className="mb-1 flex gap-2">
            {viewer.canManage ? (
              <LinkButton href={`/dashboard/${business.id}`} size="sm">Dashboard</LinkButton>
            ) : (
              <>
                <Button size="sm" variant={following ? "secondary" : "primary"} onClick={toggleFollow}>
                  {following ? "Following" : "Follow"}
                </Button>
                {viewer.loggedIn && (
                  <>
                    <Button size="sm" variant="outline" onClick={startChat} aria-label="Message">
                      <MessageCircle size={16} />
                    </Button>
                    <Button size="sm" variant="outline" loading={calling} onClick={() => startCall("voice")} aria-label="Call">
                      <Phone size={16} />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{business.name}</h1>
          {business.verified && <Badge tone="primary">✓ Verified</Badge>}
          {business.founding && <Badge tone="warning">★ Founding Business</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          @{business.username} · {business.category}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span><strong className="text-text">{formatCount(followers)}</strong> followers</span>
          {business.ratingCount > 0 && (
            <span className="flex items-center gap-1">
              <Star size={14} className="fill-accent text-accent" /> <strong className="text-text">{business.rating}</strong> ({formatCount(business.ratingCount)})
            </span>
          )}
          {(business.city || business.country) && (
            <span className="flex items-center gap-1"><MapPin size={14} />{[business.city, business.country].filter(Boolean).join(", ")}</span>
          )}
        </div>

        {business.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted line-clamp-2-ellipsis">{business.description}</p>
        )}

        <div className="mt-4 grid grid-cols-5 border-b border-border text-sm font-semibold">
          {(["posts", "offers", "products", "reviews", "about"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 py-2.5 capitalize transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* offers tab */}
        {tab === "offers" && (
          <div className="mt-4 space-y-3">
            {offers === null && <p className="py-10 text-center text-sm text-muted">Loading…</p>}
            {offers !== null && offers.length === 0 && (
              <EmptyState icon={<Tag size={28} />} title="No active offers" hint="Promotions from this business will appear here." />
            )}
            {offers?.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Tag size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{o.title}</p>
                  <p className="text-xs font-semibold text-accent">{o.discountLabel}</p>
                  <p className="text-xs text-muted">Until {timeAgo(o.endsAt)}</p>
                </div>
                {o.productId ? (
                  <Link
                    href={`/products/${o.productId}`}
                    onClick={() => getOffer(o.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-strong"
                  >
                    View
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => getOffer(o.id)}>Get offer</Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* posts tab */}
        {tab === "posts" && (
          <div className="mt-4 grid grid-cols-3 gap-1 sm:gap-2">
            {initialPosts.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-muted">No posts yet.</p>}
            {initialPosts.map((p) => (
              <Link key={p.id} href={`/p/${p.id}`} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                {p.thumbnailUrl || (p.type !== "text" && p.mediaUrls[0]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl ?? p.mediaUrls[0]} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                ) : (
                  <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted">{p.caption.slice(0, 60)}</span>
                )}
                {p.type === "video" && <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 text-[10px] text-white">▶</span>}
                <span className="absolute bottom-1 left-1.5 text-[11px] font-semibold text-white drop-shadow">♥ {formatCount(p.counts.likes)}</span>
              </Link>
            ))}
          </div>
        )}

        {/* products tab */}
        {tab === "products" && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">No products listed yet.</p>}
            {products.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md">
                <div className="aspect-square bg-surface-2">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-sm font-bold text-primary">${(p.priceCents / 100).toFixed(2)} {p.currency}</p>
                  {!p.inStock && <p className="text-xs text-danger">Out of stock</p>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* reviews tab */}
        {tab === "reviews" && (
          <div className="mt-4 space-y-4">
            {viewer.loggedIn && !viewer.canManage && (
              <Button variant="outline" onClick={() => requireAuth(() => setReviewOpen(true))}>Write a review</Button>
            )}
            {reviews.length === 0 && <EmptyState title="No reviews yet" hint="Purchases and visits can be reviewed here." />}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar src={null} name={r.author.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.author.name}</p>
                    <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
                  </div>
                  <span className="text-accent" aria-label={`${r.rating} stars`}>{"★".repeat(r.rating)}<span className="text-border">{"★".repeat(5 - r.rating)}</span></span>
                </div>
                {r.text && <p className="mt-2 text-sm text-muted">{r.text}</p>}
              </div>
            ))}
          </div>
        )}

        {/* about tab */}
        {tab === "about" && (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="whitespace-pre-wrap leading-relaxed">{business.description || "No description yet."}</p>
            </div>
            <dl className="space-y-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex justify-between"><dt className="text-muted">Category</dt><dd>{business.category}</dd></div>
              {(business.city || business.country) && (
                <div className="flex justify-between"><dt className="text-muted">Location</dt><dd>{[business.city, business.country].filter(Boolean).join(", ")}</dd></div>
              )}
              {business.website && (
                <div className="flex justify-between">
                  <dt className="text-muted">Website</dt>
                  <dd><a href={business.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Globe size={13} />{new URL(business.website).hostname}</a></dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-muted">Joined</dt><dd>{timeAgo(business.createdAt)}</dd></div>
            </dl>
            {business.claimable && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
                <p className="text-sm font-semibold">Own this business?</p>
                <p className="mt-0.5 text-xs text-muted">This profile was set up by our team. Verify your ownership to take control.</p>
                <Button size="sm" className="mt-2" onClick={() => requireAuth(() => setClaimOpen(true))}>Claim this business</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title={`Review ${business.name}`}>
        <div className="space-y-4">
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="text-3xl transition-transform active:scale-90">
                <Star size={32} className={n <= rating ? "fill-accent text-accent" : "text-border"} />
              </button>
            ))}
          </div>
          <Textarea rows={4} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience…" maxLength={1000} />
          <Button className="w-full" onClick={submitReview}>Post review</Button>
        </div>
      </Modal>

      <Modal open={claimOpen} onClose={() => setClaimOpen(false)} title={`Claim ${business.name}`}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="claim-note">Your relationship to this business</Label>
            <Input id="claim-note" value={claimNote} onChange={(e) => setClaimNote(e.target.value)} placeholder="e.g. I am the owner; registered business KG-12345 in Lagos" maxLength={500} />
          </div>
          <div>
            <Label>Proof of ownership (optional)</Label>
            {claimDoc ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs">📎 {claimDoc.name} <button type="button" className="ml-2 font-semibold text-danger hover:underline" onClick={() => setClaimDoc(null)}>Remove</button></p>
            ) : (
              <label className="flex h-16 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-muted hover:border-primary hover:text-primary">
                Attach a registration document or utility bill
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setClaimDoc(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          <p className="text-xs text-muted">Our team reviews claims manually and may request proof of ownership. False claims are a bannable offense.</p>
          <Button className="w-full" loading={claimBusy} disabled={claimNote.trim().length < 10} onClick={submitClaim}>Submit claim</Button>
        </div>
      </Modal>
    </div>
  );
}
