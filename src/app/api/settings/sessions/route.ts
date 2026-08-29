import { handle, ok } from "@/lib/api";
import { requireUser, getAuthUser } from "@/lib/auth";
import { listSessions, revokeSession, revokeAllSessions } from "@/services/user.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  const current = await getAuthUser();
  void current;
  return ok({ items: await listSessions(String(user._id)) });
});

export const DELETE = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");
  if (sessionId === "all") {
    await revokeAllSessions(String(user._id));
    return ok({ revoked: "all" });
  }
  if (sessionId) {
    await revokeSession(sessionId, String(user._id));
    return ok({ revoked: sessionId });
  }
  return ok({ revoked: null });
});
