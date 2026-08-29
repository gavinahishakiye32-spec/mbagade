import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getCallForViewer } from "@/services/call.service";
import { User } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET /api/calls/[id] — call state for the signed-in participant. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const call = await getCallForViewer(id, String(user._id));

  const isCaller = String(call.callerUserId) === String(user._id);
  const peerUserId = isCaller ? call.calleeUserId : call.callerUserId;
  const peer = await User.findById(peerUserId).select("name avatarKey").lean();

  return ok({
    call: {
      id: String(call._id),
      status: call.status,
      type: call.type,
      callerId: String(call.callerUserId),
      calleeBusinessId: String(call.businessId),
    },
    role: isCaller ? ("caller" as const) : ("callee" as const),
    peer: {
      name: peer?.name ?? "Unknown",
      avatarUrl: peer?.avatarKey ? `/api/media/${peer.avatarKey}` : null,
    },
  });
});
