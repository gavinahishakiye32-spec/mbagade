import { NextResponse } from "next/server";
import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { registerUser, createSession } from "@/services/user.service";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPlatformConfig } from "@/services/platform-config.service";
import { consumeReferralCode, requireValidReferralForRegistration, maybeAutoGrantFounding } from "@/services/growth.service";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  enforceRateLimit(req, "register", 5, 60 * 60 * 1000);
  await connectDB();
  const input = await parseJson(req, registerSchema);

  // Access lifecycle (addendum #20): private blocks self-registration entirely,
  // invite_only requires a valid pending referral code.
  const config = await getPlatformConfig();
  if (config.accessMode === "private") {
    throw new ApiError("REGISTRATION_CLOSED", "Registration is currently by invitation only. Join the waitlist instead.", 403);
  }
  await requireValidReferralForRegistration(input.referralCode);

  const { user, verifyUrl } = await registerUser(input);

  // Complete the referral relationship and grant launch-phase status (addendum #7/#8/#17/#18).
  await consumeReferralCode(input.referralCode, user._id);
  await maybeAutoGrantFounding("customer", user as never);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const sid = await createSession(String(user._id), ip, req.headers.get("user-agent") ?? "");
  const token = await signSessionToken({ sid, uid: String(user._id) });
  await setSessionCookie(token);

  return ok({
    user,
    // surfaced only in development so the flow is testable without SMTP
    emailVerificationUrl: process.env.NODE_ENV !== "production" ? verifyUrl : null,
  });
});

export function GET() {
  return NextResponse.json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, { status: 405 });
}
