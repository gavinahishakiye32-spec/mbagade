import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { resetPassword } from "@/services/user.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  enforceRateLimit(req, "reset-password", 10, 60 * 60 * 1000);
  await connectDB();
  const { token, password } = await parseJson(req, resetPasswordSchema);
  const success = await resetPassword(token, password);
  if (!success) throw new ApiError("INVALID_TOKEN", "This reset link is invalid or expired", 400);
  return ok({ reset: true });
});
