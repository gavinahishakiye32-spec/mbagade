import { handle, ok, parseJson } from "@/lib/api";
import { verifyEmailSchema } from "@/lib/validation";
import { verifyEmail } from "@/services/user.service";
import { connectDB } from "@/lib/mongodb";
import { ApiError } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  await connectDB();
  const { token } = await parseJson(req, verifyEmailSchema);
  const success = await verifyEmail(token);
  if (!success) throw new ApiError("INVALID_TOKEN", "This verification link is invalid or expired", 400);
  return ok({ verified: true });
});
