import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { callSignalSchema } from "@/lib/validation";
import { pushSignal, pullSignals, getCallForViewer } from "@/services/call.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET — pull WebRTC signals for this call (polled ~1s during active calls). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const after = new URL(req.url).searchParams.get("after");
  const [signals, call] = await Promise.all([
    pullSignals(id, after, String(user._id)),
    getCallForViewer(id, String(user._id)),
  ]);
  return ok({ signals, callStatus: call.status });
});

/** POST — push a signal (offer/answer/ICE candidate). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, callSignalSchema);
  await pushSignal(id, String(user._id), input.kind, input.data);
  return ok({ sent: true });
});
