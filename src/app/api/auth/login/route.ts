import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { authenticate, createSession } from "@/services/user.service";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  enforceRateLimit(req, "login", 10, 10 * 60 * 1000);
  await connectDB();
  const { email, password } = await parseJson(req, loginSchema);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const user = await authenticate(email, password);

  const sid = await createSession(String(user._id), ip, req.headers.get("user-agent") ?? "");
  const token = await signSessionToken({ sid, uid: String(user._id) });
  await setSessionCookie(token);
  return ok({ user });
});

export function GET() {
  throw new ApiError("METHOD_NOT_ALLOWED", "Use POST", 405);
}
