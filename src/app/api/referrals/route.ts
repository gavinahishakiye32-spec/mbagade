import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { referralInviteSchema } from "@/lib/validation";
import { createReferralInvite, listMyReferrals } from "@/services/growth.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** My referral code + invite history (addendum #17/#18). */
export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  return ok(await listMyReferrals(String(user._id)));
});

/** Create a new invite link (customers invite customers, businesses invite businesses). */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, referralInviteSchema);
  const invite = await createReferralInvite(user, input);
  return ok(invite, { status: 201 });
});
