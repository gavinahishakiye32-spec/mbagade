import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminStats, auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  return ok(await adminStats());
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  await auditLog(String(admin._id), body.action ?? "admin.action", "system", null);
  return ok({ logged: true });
});
