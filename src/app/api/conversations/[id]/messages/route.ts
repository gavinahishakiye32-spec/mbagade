import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { messageSendSchema } from "@/lib/validation";
import { listMessages, sendMessage } from "@/services/message.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  return ok(await listMessages(id, url.searchParams.get("cursor"), 30, String(user._id)));
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, messageSendSchema);
  const message = await sendMessage(id, String(user._id), input.text, input.mediaKey);
  return ok(message, { status: 201 });
});
