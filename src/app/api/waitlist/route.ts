import { handle, ok, parseJson } from "@/lib/api";
import { waitlistSchema } from "@/lib/validation";
import { joinWaitlist } from "@/services/growth.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

/** Public pre-launch waitlist signup (addendum #19). */
export const POST = handle(async (req: Request) => {
  enforceRateLimit(req, "waitlist", 5, 60 * 60 * 1000);
  await connectDB();
  const input = await parseJson(req, waitlistSchema);
  const result = await joinWaitlist(input);
  return ok(result);
});
