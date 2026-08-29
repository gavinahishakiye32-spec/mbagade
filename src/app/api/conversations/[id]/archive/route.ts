import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { setArchived } from "@/services/message.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const archived = url.searchParams.get("state") !== "0";
  await setArchived(id, String(user._id), archived);
  return ok({ archived });
});
