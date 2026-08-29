import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toggleLike } from "@/services/post.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok(await toggleLike(String(user._id), id));
});
