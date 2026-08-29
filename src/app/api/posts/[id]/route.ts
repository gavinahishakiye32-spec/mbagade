import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser, getAuthUser } from "@/lib/auth";
import { updatePostSchema } from "@/lib/validation";
import { updatePost, deletePost } from "@/services/post.service";
import { Post, Business, User } from "@/server/models";
import { loadViewerContext, toPostView } from "@/services/view.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const post = await Post.findOne({ _id: id, status: { $ne: "removed" } }).lean();
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);
  const business = post.authorType === "business" && post.businessId
    ? await Business.findById(post.businessId).lean()
    : null;
  const user = post.authorType === "user"
    ? await User.findById(post.authorUserId).lean()
    : null;
  if (post.authorType === "business" && !business) throw new ApiError("NOT_FOUND", "Post not found", 404);
  const viewer = await getAuthUser();
  const ctxv = await loadViewerContext(viewer ? String(viewer._id) : null, [post]);
  return ok({ post: toPostView(post, business, ctxv, { user }) });
});

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const patch = await parseJson(req, updatePostSchema);
  const post = await updatePost(String(user._id), id, patch as never);
  return ok({ id: String(post._id), status: post.status });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  await deletePost(String(user._id), id);
  return ok({ deleted: true });
});
