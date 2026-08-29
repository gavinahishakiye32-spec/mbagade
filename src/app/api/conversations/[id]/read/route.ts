import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markRead } from "@/services/message.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  await markRead(id, String(user._id));
  return ok({ read: true });
});
