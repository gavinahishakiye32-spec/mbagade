import { handle, ok, parseJson } from "@/lib/api";
import { getAuthUser, requireUser } from "@/lib/auth";
import { commentCreateSchema } from "@/lib/validation";
import { addComment, listComments } from "@/services/post.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const viewer = await getAuthUser();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  return ok(await listComments(id, url.searchParams.get("cursor"), 20, viewer ? String(viewer._id) : null));
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  enforceRateLimit(req, "comment", 10, 60 * 1000, String(user._id));
  const { id } = await ctx.params;
  const input = await parseJson(req, commentCreateSchema);
  const comment = await addComment(String(user._id), id, input.text, input.parentId);
  return ok(
    {
      id: String(comment._id),
      text: comment.text,
      status: comment.status,
    },
    { status: 201 }
  );
});
