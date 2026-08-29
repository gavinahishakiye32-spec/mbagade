import type { IBusiness, IPost, IProduct, IUser, PostView, BusinessSummary, UserSummary, PostAuthor } from "@/types";
import { mediaUrl } from "@/lib/utils";
import { Follow, Like, SavedPost } from "@/server/models";

export function toBusinessSummary(b: IBusiness): BusinessSummary {
  return {
    id: String(b._id),
    username: b.username,
    name: b.name,
    logoUrl: mediaUrl(b.logoKey),
    verified: b.verification === "verified",
    category: b.category,
    city: b.city,
    country: b.country,
  };
}

export function toUserSummary(u: IUser): UserSummary {
  return {
    id: String(u._id),
    username: u.username,
    name: u.name,
    avatarUrl: mediaUrl(u.avatarKey),
  };
}

export interface ProductSummary {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
}

export interface SoundSummary {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
}

export function toProductSummary(p: IProduct): ProductSummary {
  return {
    id: String(p._id),
    name: p.name,
    priceCents: p.priceCents,
    currency: p.currency,
    imageUrl: p.imageKeys?.[0] ? mediaUrl(p.imageKeys[0]) : null,
  };
}

export interface ViewerContext {
  viewerId: string | null;
  likedIds: Set<string>;
  savedIds: Set<string>;
  followedBusinessIds: Set<string>;
  followedUserIds: Set<string>;
}

export function emptyViewerContext(): ViewerContext {
  return {
    viewerId: null,
    likedIds: new Set(),
    savedIds: new Set(),
    followedBusinessIds: new Set(),
    followedUserIds: new Set(),
  };
}

export async function loadViewerContext(viewerId: string | null, posts: IPost[]): Promise<ViewerContext> {
  if (!viewerId || posts.length === 0) return emptyViewerContext();
  const ids = posts.map((p) => p._id);
  const bizIds = [...new Set(posts.filter((p) => p.authorType === "business").map((p) => String(p.businessId)))];
  const userIds = [
    ...new Set(
      posts
        .filter((p) => p.authorType === "user")
        .map((p) => String(p.authorUserId))
        .concat(
          // also let viewers follow a business author via their post's businessId
          bizIds.map((id) => id)
        )
    ),
  ];
  const [likes, saves, follows] = await Promise.all([
    Like.find({ userId: viewerId, postId: { $in: ids } }).select("postId").lean(),
    SavedPost.find({ userId: viewerId, postId: { $in: ids } }).select("postId").lean(),
    Follow.find({
      userId: viewerId,
      $or: [{ businessId: { $in: bizIds } }, { followedUserId: { $in: userIds } }],
    })
      .select("businessId followedUserId followingType")
      .lean(),
  ]);
  const followedBusinessIds = new Set<string>();
  const followedUserIds = new Set<string>();
  for (const f of follows) {
    if (f.followingType === "user" && f.followedUserId) followedUserIds.add(String(f.followedUserId));
    if (f.followingType === "business" && f.businessId) followedBusinessIds.add(String(f.businessId));
  }
  return {
    viewerId,
    likedIds: new Set(likes.map((l) => String(l.postId))),
    savedIds: new Set(saves.map((s) => String(s.postId))),
    followedBusinessIds,
    followedUserIds,
  };
}

export function authorOf(post: IPost, opts: { business?: IBusiness | null; user?: IUser | null }): {
  author: PostAuthor;
  business: BusinessSummary | null;
} {
  if (post.authorType === "business" && opts.business) {
    const business = toBusinessSummary(opts.business);
    return { author: { kind: "business", ...business } as PostAuthor, business };
  }
  // user post (or business author missing → fall back to the user)
  const user = opts.user ?? null;
  const name = user?.name ?? "BuyBuy User";
  const username = user?.username ?? "user";
  const avatarUrl = user ? toUserSummary(user).avatarUrl : null;
  return {
    author: { kind: "user", id: user ? String(user._id) : String(post.authorUserId), username, name, avatarUrl },
    business: null,
  };
}

export function toPostView(
  post: IPost,
  business: IBusiness | null,
  ctx: ViewerContext,
  opts?: {
    user?: IUser | null;
    sponsoredLabel?: string | null;
    products?: IProduct[];
    sound?: SoundSummary | null;
  }
): PostView {
  const { author, business: businessView } = authorOf(post, { business, user: opts?.user });
  const followed =
    post.authorType === "business"
      ? ctx.followedBusinessIds.has(String(post.businessId))
      : ctx.followedUserIds.has(String(post.authorUserId));

  return {
    id: String(post._id),
    type: post.type,
    caption: post.caption,
    mediaUrls: (post.mediaKeys ?? []).map((k) => mediaUrl(k)).filter((u): u is string => Boolean(u)),
    thumbnailUrl: mediaUrl(post.thumbnailKey),
    hashtags: post.hashtags ?? [],
    author,
    business: businessView,
    counts: {
      views: post.viewsCount,
      likes: post.likesCount,
      comments: post.commentsCount,
      shares: post.sharesCount,
      saves: post.savesCount,
    },
    viewer: {
      liked: ctx.likedIds.has(String(post._id)),
      saved: ctx.savedIds.has(String(post._id)),
      following: followed,
    },
    isSponsored: Boolean(opts?.sponsoredLabel),
    sponsoredLabel: opts?.sponsoredLabel ?? null,
    sound: opts?.sound ?? null,
    products: (opts?.products ?? []).map(toProductSummary),
    city: post.city,
    country: post.country,
    createdAt: post.createdAt.toISOString(),
  };
}
