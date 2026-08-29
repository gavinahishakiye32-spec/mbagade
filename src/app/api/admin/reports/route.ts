import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminReportResolveSchema } from "@/lib/validation";
import { Report } from "@/server/models";
import { resolveReport } from "@/services/report.service";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";

  const reports = await Report.find(status === "all" ? {} : { status })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("reporterId", "name username")
    .lean();

  return ok({
    items: (reports as unknown as {
      _id: { toString(): string };
      targetType: string;
      targetId: { toString(): string };
      reason: string;
      details: string;
      status: string;
      resolution?: string | null;
      createdAt: Date;
      reporterId: { name: string; username: string };
    }[]).map((r) => ({
      id: r._id.toString(),
      targetType: r.targetType,
      targetId: r.targetId.toString(),
      reason: r.reason,
      details: r.details,
      status: r.status,
      resolution: r.resolution ?? null,
      reporter: r.reporterId?.name ?? "?",
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(
    req,
    adminReportResolveSchema.extend({ reportId: z.string().min(1).max(64) })
  );
  await resolveReport(String(admin._id), input.reportId, input.decision, input.resolution, input.note);
  await auditLog(String(admin._id), `report.${input.decision}`, "report", input.reportId, { resolution: input.resolution });
  return ok({ resolved: true });
});
