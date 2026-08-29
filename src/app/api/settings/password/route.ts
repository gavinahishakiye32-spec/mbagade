import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import { changePassword } from "@/services/user.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  enforceRateLimit(req, "change-password", 5, 60 * 60 * 1000, String(user._id));
  const input = await parseJson(req, changePasswordSchema);
  await changePassword(String(user._id), input.currentPassword, input.newPassword);
  return ok({ changed: true });
});
