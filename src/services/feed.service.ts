import { Types, QueryFilter } from "mongoose";
import { Post, Business, Follow, Block, Advertisement, SavedPost, User, Sound, Like } from "@/server/models";
import type { IPost, IBusiness, IUser, ISound, PostView } from "@/types";
import { loadViewerContext, toPostView } from "@/services/view.service";
import { computePostScore, shouldRescore } from "@/services/feed-scoring";
import { cursorPaginate } from "@/lib/api";

/** How many candidate posts to consider for per-viewer re-ranking per page. */
const RE_RANK_WINDOW_BASE = 3;
const RE_RANK_WINDOW_MIN = 24;
/** Max likes/follows scanned to build implicit category affinity. */
const AFFINITY_SIGNAL_CAP = 200;

export interface FeedParams {
  tab: "for-you" | "following" | "trending" | "nearby" | "saved" | "reels";
  category?: string;
  businessId?: string;
  cursor?: string;
  lat?: number;
  lng?: number;
  country?: string;
  city?: string;
  limit: number;
}

export interface FeedResult {
  items: PostView[];
  nextCursor: string | null;
}

const CANDIDATE_WINDOW = 7; // days of content eligible for scoring feeds

function baseFilter(): QueryFilter<IPost> {
  return {
    status: "published",
    visibility: "public",
    createdAt: { $gte: new Date(Date.now() - CANDIDATE_WINDOW * 86_400_000) },
  };
}

async function excludedIds(viewerId: string | null): Promise<{ businessIds: Types.ObjectId[]; userIds: Types.ObjectId[] }> {
  if (!viewerId) return { businessIds: [], userIds: [] };
  const [blocks, suspendedBiz, suspendedUsers] = await Promise.all([
    Block.find({ blockerId: viewerId }).select("blockedId").lean(),
    Business.find({ status: "suspended" }).select("_id").lean(),
    User.find({ status: { $in: ["suspended", "banned"] } }).select("_id").lean(),
  ]);
  const blockedBiz = blocks.map((b) => b.blockedId as Types.ObjectId);
  const blockedUsers = blocks.map((b) => b.blockedId as Types.ObjectId);
  return {
    businessIds: [...blockedBiz, ...suspendedBiz.map((b) => b._id as Types.ObjectId)],
    userIds: [...blockedUsers, ...suspendedUsers.map((u) => u._id as Types.ObjectId)],
  };
}

/** Rescore stale posts (denormalized scoreCache) so ranking stays fresh without a scheduler. */
async function refreshScores(posts: IPost[]): Promise<void> {
  const now = Date.now();
  const businessIds = [...new Set(posts.filter((p) => p.authorType === "business").map((p) => String(p.businessId)))];
  const businesses = await Business.find({ _id: { $in: businessIds } })
    .select("createdAt followersCount")
    .lean<IBusiness[]>();
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));
  const userIds = [...new Set(posts.filter((p) => p.authorType === "user").map((p) => String(p.authorUserId)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("createdAt followersCount")
    .lean<IUser[]>();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const ops = posts
    .filter((p) => shouldRescore(p.scoreUpdatedAt, now))
    .map((p) => {
      const isNew = p.authorType === "business"
        ? (() => {
            const biz = bizMap.get(String(p.businessId));
            return Boolean(biz) && (now - biz!.createdAt.getTime()) / 86_400_000 < 30 && (biz?.followersCount ?? 0) < 1000;
          })()
        : (() => {
            const u = userMap.get(String(p.authorUserId));
            return Boolean(u) && (now - u!.createdAt.getTime()) / 86_400_000 < 30 && (u?.followersCount ?? 0) < 1000;
          })();
      const score = computePostScore({
        likes: p.likesCount,
        comments: p.commentsCount,
        shares: p.sharesCount,
        saves: p.savesCount,
        followsGenerated: p.followsGenerated,
        productClicks: p.productClicks,
        contactClicks: p.contactClicks,
        views: p.viewsCount,
        reports: p.reportsCount,
        createdAtMs: p.createdAt.getTime(),
        nowMs: now,
        newBusiness: isNew,
      });
      return {
        updateOne: { filter: { _id: p._id }, update: { $set: { scoreCache: score, scoreUpdatedAt: new Date(now) } } },
      };
    });

  if (ops.length > 0) await Post.bulkWrite(ops, { ordered: false });
}

async function hydratePosts(posts: IPost[], viewerId: string | null): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const businessIds = [...new Set(posts.filter((p) => p.authorType === "business").map((p) => String(p.businessId)))];
  const businesses = businessIds.length
    ? await Business.find({ _id: { $in: businessIds } }).lean<IBusiness[]>()
    : [];
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));
  const userIds = [...new Set(posts.filter((p) => p.authorType === "user").map((p) => String(p.authorUserId)))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).lean<IUser[]>()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const ctx = await loadViewerContext(viewerId, posts);

  // hydrate attached products
  const productRefs = posts.flatMap((p) => (p.productIds ?? []).map((id) => String(id)));
  let productsById = new Map<string, import("@/types").IProduct>();
  if (productRefs.length > 0) {
    const { Product } = await import("@/server/models");
    const products = await Product.find({ _id: { $in: productRefs }, status: "active" }).lean();
    productsById = new Map(products.map((p) => [String(p._id), p]));
  }

  // hydrate attached sounds
  const soundRefs = [...new Set(posts.filter((p) => p.soundId).map((p) => String(p.soundId)))];
  let soundsById = new Map<string, ISound>();
  if (soundRefs.length > 0) {
    const sounds = await Sound.find({ _id: { $in: soundRefs }, status: "active" }).lean<ISound[]>();
    soundsById = new Map(sounds.map((s) => [String(s._id), s]));
  }

  return posts
    .filter((p) => p.authorType === "business" ? bizMap.has(String(p.businessId)) : userMap.has(String(p.authorUserId)))
    .map((p) => {
      const sound = p.soundId ? soundsById.get(String(p.soundId)) : undefined;
      return toPostView(p, p.authorType === "business" ? bizMap.get(String(p.businessId))! : null, ctx, {
        user: p.authorType === "user" ? userMap.get(String(p.authorUserId)) : undefined,
        products: (p.productIds ?? [])
          .map((id) => productsById.get(String(id)))
          .filter((x): x is import("@/types").IProduct => Boolean(x)),
        sound: sound ? {
          id: String(sound._id),
          title: sound.title,
          artist: sound.artist,
          audioUrl: `/api/media/${sound.audioKey}`,
          coverUrl: sound.coverKey ? `/api/media/${sound.coverKey}` : null,
        } : null,
      });
    });
}

/* ---------- Per-viewer personalization ---------- */

interface ViewerSignal {
  /** category -> normalized 0..1 affinity weight (1 = strongest interest). */
  categoryAffinity: Map<string, number>;
  city: string | null;
  country: string | null;
}

/**
 * Derives a lightweight per-viewer interest profile from implicit signals
 * already in the database: the categories of businesses the viewer follows,
 * plus the categories of authors the viewer has liked. No separate
 * tracking/events subsystem is required.
 */
async function loadViewerSignal(viewerId: string | null): Promise<ViewerSignal> {
  const empty: ViewerSignal = { categoryAffinity: new Map(), city: null, country: null };
  if (!viewerId) return empty;

  const [user, follows, likes] = await Promise.all([
    User.findById(viewerId).select("city country").lean<IUser | null>(),
    Follow.find({ userId: viewerId, businessId: { $ne: null } }).select("businessId").limit(AFFINITY_SIGNAL_CAP).lean(),
    Like.find({ userId: viewerId }).select("postId").sort({ createdAt: -1 }).limit(AFFINITY_SIGNAL_CAP).lean(),
  ]);

  const bizIds = new Set<string>();
  for (const f of follows) if (f.businessId) bizIds.add(String(f.businessId));
  const likePostIds = likes.map((l) => l.postId);
  if (likePostIds.length > 0) {
    const posts = await Post.find({ _id: { $in: likePostIds }, businessId: { $ne: null } })
      .select("businessId")
      .lean<{ businessId: Types.ObjectId }[]>();
    for (const p of posts) if (p.businessId) bizIds.add(String(p.businessId));
  }

  const categoryFreq = new Map<string, number>();
  if (bizIds.size > 0) {
    const businesses = await Business.find({ _id: { $in: [...bizIds] }, status: "active" })
      .select("category")
      .lean<{ _id: Types.ObjectId; category: string }[]>();
    for (const b of businesses) {
      if (!b.category) continue;
      categoryFreq.set(b.category, (categoryFreq.get(b.category) ?? 0) + 1);
    }
  }

  // Normalize raw counts into 0..1 affinity weights.
  const categoryAffinity = new Map<string, number>();
  const max = Math.max(1, ...[...categoryFreq.values()]);
  for (const [cat, count] of categoryFreq) categoryAffinity.set(cat, count / max);

  return {
    categoryAffinity,
    city: user?.city ?? null,
    country: user?.country ?? null,
  };
}

interface BizMeta {
  category: string;
  isNew: boolean;
}

/** New-account check (same rule as rescoring) + category, keyed by business id. */
async function loadBizMeta(businessIds: string[], userAuthorIds: string[]): Promise<{
  biz: Map<string, BizMeta>;
  userNew: Map<string, boolean>;
}> {
  const now = Date.now();
  const biz = new Map<string, BizMeta>();
  if (businessIds.length > 0) {
    const businesses = await Business.find({ _id: { $in: businessIds } })
      .select("category createdAt followersCount")
      .lean<IBusiness[]>();
    for (const b of businesses) {
      biz.set(String(b._id), {
        category: b.category ?? "",
        isNew: (now - b.createdAt.getTime()) / 86_400_000 < 30 && (b.followersCount ?? 0) < 1000,
      });
    }
  }
  const userNew = new Map<string, boolean>();
  if (userAuthorIds.length > 0) {
    const users = await User.find({ _id: { $in: userAuthorIds } })
      .select("createdAt followersCount")
      .lean<IUser[]>();
    for (const u of users) {
      userNew.set(String(u._id), (now - u.createdAt.getTime()) / 86_400_000 < 30 && (u.followersCount ?? 0) < 1000);
    }
  }
  return { biz, userNew };
}

export async function getFeed(params: FeedParams, viewerId: string | null): Promise<FeedResult> {
  const exclude = await excludedIds(viewerId);

  const filter: QueryFilter<IPost> & Record<string, unknown> = baseFilter() as QueryFilter<IPost> & Record<string, unknown>;
  if (exclude.businessIds.length > 0 || exclude.userIds.length > 0) {
    filter.$nor = [
      ...(exclude.businessIds.length > 0 ? [{ businessId: { $in: exclude.businessIds } }] : []),
      ...(exclude.userIds.length > 0 ? [{ authorUserId: { $in: exclude.userIds } }] : []),
    ];
  }

  // Category filtering happens through the business category — resolve matching businesses.
  if (params.category) {
    const bizIds = (
      await Business.find({ category: params.category, status: "active" }).select("_id").limit(5000).lean()
    ).map((b) => b._id as Types.ObjectId);
    const bizClause: QueryFilter<IPost> & Record<string, unknown> = { businessId: { $in: bizIds } };
    if (filter.$nor) bizClause.$nor = filter.$nor;
    delete filter.$nor;
    delete filter.businessId;
    filter.$and = [bizClause];
  }

  if (params.tab === "nearby") {
    if (params.lat != null && params.lng != null) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [params.lng, params.lat] },
          $maxDistance: 50_000,
        },
      };
    } else if (params.city) {
      filter.city = params.city;
    } else if (params.country) {
      filter.country = params.country;
    }
  }

  if (params.tab === "following") {
    if (!viewerId) return { items: [], nextCursor: null };
    const follows = await Follow.find({ userId: viewerId }).lean();
    const bizIds = follows
      .filter((f) => f.followingType === "business" && f.businessId)
      .map((f) => f.businessId as Types.ObjectId)
      .filter((id) => !exclude.businessIds.some((e) => String(e) === String(id)));
    const authorIds = follows
      .filter((f) => f.followingType === "user" && f.followedUserId)
      .map((f) => f.followedUserId as Types.ObjectId)
      .filter((id) => !exclude.userIds.some((e) => String(e) === String(id)));
    if (bizIds.length === 0 && authorIds.length === 0) return { items: [], nextCursor: null };
    const orClauses: QueryFilter<IPost>[] = [];
    if (bizIds.length > 0) orClauses.push({ businessId: { $in: bizIds } });
    if (authorIds.length > 0) orClauses.push({ authorType: "user", authorUserId: { $in: authorIds } } as QueryFilter<IPost>);
    (filter as QueryFilter<IPost>).$or = orClauses;
    if (params.cursor) {
      const d = new Date(params.cursor);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }

    const docs = await Post.find(filter).sort({ createdAt: -1 }).limit(params.limit + 1).lean<IPost[]>();
    const page = cursorPaginate(docs, params.limit);
    const items = await hydratePosts(page.items, viewerId);
    const nextCursor =
      page.nextCursor && page.items.length > 0
        ? page.items[page.items.length - 1].createdAt.toISOString()
        : null;
    return { items, nextCursor };
  }

  if (params.tab === "saved") {
    if (!viewerId) return { items: [], nextCursor: null };
    const saves = await SavedPost.find({ userId: viewerId })
      .sort({ createdAt: -1 })
      .skip(params.cursor && !Number.isNaN(Number(params.cursor)) ? Number(params.cursor) : 0)
      .limit(params.limit + 1)
      .select("postId")
      .lean();
    const hasMore = saves.length > params.limit;
    const ids = saves.slice(0, params.limit).map((s) => s.postId as Types.ObjectId);
    if (ids.length === 0) return { items: [], nextCursor: null };
    delete filter.businessId;
    delete filter.$nor;
    filter._id = { $in: ids };
    const docs = await Post.find(filter).lean<IPost[]>();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const ordered = ids.map((id) => byId.get(String(id))).filter((x): x is IPost => Boolean(x));
    const items = await hydratePosts(ordered, viewerId);
    const nextCursor = hasMore ? String((params.cursor && !Number.isNaN(Number(params.cursor)) ? Number(params.cursor) : 0) + params.limit) : null;
    return { items, nextCursor };
  }

  // Scored feeds: for-you / trending / nearby / category browsing / reels
  if (params.tab === "reels") {
    // Short-video feed — restrict to published video posts.
    (filter as QueryFilter<IPost> & Record<string, unknown>).type = "video";
  }

  await maybeRescoreWindow(filter);

  const nowMs = Date.now();
  const shortVideo = params.tab === "reels";

  const sortScoreDesc = { scoreCache: -1, _id: -1 } as const;
  if (params.cursor) {
    try {
      const [scoreStr, idStr] = Buffer.from(params.cursor, "base64").toString("utf8").split(":");
      const score = Number(scoreStr);
      const id = new Types.ObjectId(idStr);
      filter.$or = [{ scoreCache: { $lt: score } }, { scoreCache: score, _id: { $lt: id } }];
    } catch {
      /* invalid cursor → start from top */
    }
  }

  // Per-viewer personalization: implicit interest signals + locality.
  const viewerSignal = await loadViewerSignal(viewerId);

  // Fetch a candidate window, then re-rank in memory by an effective per-viewer
  // score (short-video weights + category affinity + locality). We examine
  // windowLimit candidates per page and advance the cursor past the whole
  // window so re-ranking never drops or duplicates posts.
  const windowLimit = Math.max(RE_RANK_WINDOW_MIN, params.limit * RE_RANK_WINDOW_BASE);
  const windowed = await Post.find(filter).sort(sortScoreDesc).limit(windowLimit + 1).lean<IPost[]>();
  const hasMoreWindow = windowed.length > windowLimit;
  const candidates = hasMoreWindow ? windowed.slice(0, windowLimit) : windowed;

  const bizIds = [...new Set(candidates.filter((p) => p.authorType === "business" && p.businessId).map((p) => String(p.businessId)))];
  const userAuthorIds = [...new Set(candidates.filter((p) => p.authorType === "user").map((p) => String(p.authorUserId)))];
  const { biz, userNew } = await loadBizMeta(bizIds, userAuthorIds);

  const ranked = candidates
    .map((p) => {
      const isBiz = p.authorType === "business";
      const meta = isBiz ? biz.get(String(p.businessId)) : null;
      const isNew = isBiz ? Boolean(meta?.isNew) : Boolean(userNew.get(String(p.authorUserId)));
      const category = isBiz ? meta?.category ?? null : null;
      const affinity = category ? (viewerSignal.categoryAffinity.get(category) ?? 0) : 0;
      const sameCity = Boolean(p.city && viewerSignal.city && p.city === viewerSignal.city);
      const score = computePostScore({
        likes: p.likesCount,
        comments: p.commentsCount,
        shares: p.sharesCount,
        saves: p.savesCount,
        followsGenerated: p.followsGenerated,
        productClicks: p.productClicks,
        contactClicks: p.contactClicks,
        views: p.viewsCount,
        reports: p.reportsCount,
        createdAtMs: p.createdAt.getTime(),
        nowMs,
        newBusiness: isNew,
        categoryAffinity: affinity,
        sameCity,
        shortVideo,
      });
      return { post: p, score };
    })
    .sort((a, b) => b.score - a.score || String(b.post._id).localeCompare(String(a.post._id)));

  const page = ranked.slice(0, params.limit);
  const items = await hydratePosts(page.map((r) => r.post), viewerId);

  // Advance cursor past the entire examined window to avoid duplicates/re-loss.
  let nextCursor: string | null = null;
  if (hasMoreWindow && candidates.length > 0) {
    const last = candidates[candidates.length - 1];
    nextCursor = Buffer.from(`${last.scoreCache}:${String(last._id)}`).toString("base64");
  }
  return { items, nextCursor };
}

/** Rescoring window: only rescore the freshest slice to keep reads cheap. */
async function maybeRescoreWindow(filter: QueryFilter<IPost>): Promise<void> {
  const staleCheck: QueryFilter<IPost> = { ...filter };
  delete (staleCheck as Record<string, unknown>).$or;
  const stale = await Post.find({ ...staleCheck, scoreUpdatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } })
    .sort({ createdAt: -1 })
    .limit(120)
    .lean<IPost[]>();
  if (stale.length > 0) await refreshScores(stale);
}

/**
 * Picks active sponsored posts for feed injection (first page only).
 * Returns the post documents plus their campaign labels.
 */
export async function pickSponsored(
  viewerCountry: string | null,
  limit = 1
): Promise<{ post: IPost; label: string; adId: string }[]> {
  const ads = await Advertisement.find({
    status: "active",
    endsAt: { $gte: new Date() },
    postId: { $ne: null },
    ...(viewerCountry ? { $or: [{ "targeting.countries": viewerCountry }, { "targeting.countries": { $size: 0 } }] } : {}),
  })
    .sort({ spentCents: 1 }) // rotate fairly between budgets
    .limit(limit)
    .populate<{ postId: IPost | null }>("postId");

  const out: { post: IPost; label: string; adId: string }[] = [];
  for (const ad of ads) {
    if (!ad.postId || typeof ad.postId !== "object") continue;
    const post = ad.postId as unknown as IPost & { _id: Types.ObjectId };
    if (post.status !== "published") continue;
    out.push({ post, label: "Sponsored", adId: String(ad._id) });
  }
  return out;
}
