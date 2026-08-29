import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { incomingCalls } from "@/services/call.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** Polled by the client to detect incoming calls. */
export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  const calls = await incomingCalls(String(user._id));
  return ok({
    items: calls.map((c) => ({ id: String(c._id), type: c.type, callerId: String(c.callerUserId) })),
  });
});
