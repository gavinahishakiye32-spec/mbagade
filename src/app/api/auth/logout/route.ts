import { handle, ok } from "@/lib/api";
import { readSessionToken, clearSessionCookie, verifySessionToken } from "@/lib/session";
import { revokeSession } from "@/services/user.service";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async () => {
  const token = await readSessionToken();
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims) {
      await connectDB();
      await revokeSession(claims.sid, claims.uid);
    }
  }
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
