import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { respondToCall } from "@/services/call.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, z.object({ action: z.enum(["accept", "reject", "end"]) }));
  const call = await respondToCall(id, String(user._id), input.action);
  return ok({ status: call.status });
});
