import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getSound, deleteSound } from "@/services/sound.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET /api/sounds/[id] — fetch one sound (public). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const view = await getSound(id);
  return ok(view);
});

/** DELETE /api/sounds/[id] — remove one of your own sounds. */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await connectDB();
  const { id } = await ctx.params;
  await deleteSound(String(user._id), id);
  return ok({ deleted: true });
});
