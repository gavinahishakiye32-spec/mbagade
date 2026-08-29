import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { callStartSchema } from "@/lib/validation";
import { startCall, callHistory } from "@/services/call.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, callStartSchema);
  const call = await startCall(String(user._id), input.businessId, input.type);
  return ok({ id: String(call._id), status: call.status }, { status: 201 });
});

export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  return ok({
    items: (await callHistory(String(user._id))).map((c) => ({
      id: String(c._id),
      type: c.type,
      status: c.status,
      peerName: c.peerName,
      durationSec: c.durationSec,
      outgoing: String(c.callerUserId) === String(user._id),
      createdAt: c.createdAt.toISOString(),
    })),
  });
});
