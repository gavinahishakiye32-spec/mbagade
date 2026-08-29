import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { listLiveMessages, sendLiveMessage } from "@/services/live.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const after = new URL(req.url).searchParams.get("after");
  return ok({ items: await listLiveMessages(id, after) });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  enforceRateLimit(req, "live-chat", 20, 60 * 1000, String(user._id));
  const { id } = await ctx.params;
  const input = await parseJson(req, z.object({ text: z.string().trim().min(1).max(500) }));
  const message = await sendLiveMessage(id, String(user._id), input.text);
  return ok(message, { status: 201 });
});
