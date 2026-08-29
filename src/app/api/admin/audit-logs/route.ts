import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { AuditLog } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("actorUserId", "name email")
    .lean();

  return ok({
    items: (logs as unknown as {
      _id: { toString(): string };
      action: string;
      targetType: string;
      targetId?: { toString(): string } | null;
      detail: Record<string, unknown>;
      createdAt: Date;
      actorUserId?: { name: string; email: string } | null;
    }[]).map((l) => ({
      id: l._id.toString(),
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId ? l.targetId.toString() : null,
      actor: l.actorUserId?.email ?? "?",
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});
