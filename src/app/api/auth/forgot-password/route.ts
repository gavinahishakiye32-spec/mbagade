import { handle, ok, parseJson } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/services/user.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  enforceRateLimit(req, "forgot-password", 5, 60 * 60 * 1000);
  await connectDB();
  const { email } = await parseJson(req, forgotPasswordSchema);
  const url = await requestPasswordReset(email);
  // Always respond the same way — never reveal whether the account exists.
  return ok({
    sent: true,
    devUrl: process.env.NODE_ENV !== "production" ? url : null,
  });
});
