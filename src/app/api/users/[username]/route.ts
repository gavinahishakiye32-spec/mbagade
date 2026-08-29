import { handle, ok, ApiError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { getPublicUser, isFollowingUser } from "@/services/user.service";
import { Post, Follow } from "@/server/models";
import { toUserSummary } from "@/services/view.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ username: string }> }) => {
  await connectDB();
  const { username } = await ctx.params;
  const user = await getPublicUser(username);
  if (!user || user.status === "banned") throw new ApiError("NOT_FOUND", "User not found", 404);

  const viewer = await getAuthUser();
  const viewerId = viewer ? String(viewer._id) : null;

  const [followingCount, postsCount, isSelf] = await Promise.all([
    Follow.countDocuments({ userId: user._id }),
    Post.countDocuments({ authorType: "user", authorUserId: user._id, status: "published" }),
    viewer ? Promise.resolve(String(viewer._id) === String(user._id)) : Promise.resolve(false),
  ]);

  return ok({
    profile: {
      ...toUserSummary(user),
      bio: user.bio,
      country: user.country,
      city: user.city,
      joinedAt: user.createdAt.toISOString(),
      followers: user.followersCount ?? 0,
      following: followingCount,
      posts: postsCount,
    },
    viewerFollowing: viewer ? await isFollowingUser(viewerId, String(user._id)) : false,
    isSelf,
  });
});
