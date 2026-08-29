import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPostSchema } from "@/lib/validation";
import { createPost } from "@/services/post.service";
import { Post, BusinessMember, User } from "@/server/models";
import type { IPost } from "@/types";
import { connectDB } from "@/lib/mongodb";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

/** GET /api/posts?businessId=&username=&mine=1 — list posts. */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  const username = url.searchParams.get("username");
  const mine = url.searchParams.get("mine") === "1";
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);

  const filter: Record<string, unknown> = {};
  if (mine) {
    const user = await requireUser();
    const memberships = await BusinessMember.find({ userId: user._id }).select("businessId").lean();
    filter.$or = [
      { businessId: { $in: memberships.map((m) => m.businessId) } },
      { authorType: "user", authorUserId: user._id },
    ];
  } else if (username) {
    const author = await User.findOne({ username: username.toLowerCase() }).select("_id").lean();
    if (!author) throw new ApiError("NOT_FOUND", "User not found", 404);
    filter.authorType = "user";
    filter.authorUserId = author._id;
    filter.status = "published";
  } else if (businessId && /^[a-f0-9]{24}$/i.test(businessId)) {
    filter.businessId = businessId;
    filter.status = "published";
  } else {
    throw new ApiError("INVALID_INPUT", "Provide businessId, username or mine=1", 422);
  }
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

  const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate("businessId", "name username logoKey verification").lean();
  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;

  return ok({
    items: page.map((p) => {
      const post = p as unknown as IPost & { businessId: { _id: Types.ObjectId; name: string; username: string; logoKey: string | null; verification: string } | null };
      return {
        id: String(post._id),
        type: post.type,
        caption: post.caption,
        mediaUrls: post.mediaKeys?.map((k) => `/api/media/${k}`) ?? [],
        thumbnailUrl: post.thumbnailKey ? `/api/media/${post.thumbnailKey}` : null,
        status: post.status,
        counts: { views: post.viewsCount, likes: post.likesCount, comments: post.commentsCount, shares: post.sharesCount, saves: post.savesCount },
        business: post.businessId ? {
          id: String(post.businessId._id),
          name: post.businessId.name,
          username: post.businessId.username,
          logoUrl: post.businessId.logoKey ? `/api/media/${post.businessId.logoKey}` : null,
          verified: post.businessId.verification === "verified",
        } : null,
        createdAt: post.createdAt.toISOString(),
      };
    }),
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  });
});

/** POST /api/posts[?businessId=] — create a post for a business you manage, or as a personal creator. */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  let businessId = url.searchParams.get("businessId");
  if (businessId && !/^[a-f0-9]{24}$/i.test(businessId)) businessId = null;
  const input = await parseJson(req, createPostSchema);
  const post = await createPost(String(user._id), businessId, input as never);
  return ok({ id: String(post._id), status: post.status }, { status: 201 });
});
