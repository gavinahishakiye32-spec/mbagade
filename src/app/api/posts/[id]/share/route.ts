import { handle, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { sharePost } from "@/services/post.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const viewer = await getAuthUser();
  const { id } = await ctx.params;
  return ok(await sharePost(viewer ? String(viewer._id) : null, id));
});
