import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAccount } from "@/services/user.service";
import { clearSessionCookie } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const DELETE = handle(async () => {
  await connectDB();
  const user = await requireUser();
  await deleteAccount(String(user._id));
  await clearSessionCookie();
  return ok({ deleted: true });
});
