import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { reportCreateSchema } from "@/lib/validation";
import { createReport } from "@/services/report.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  enforceRateLimit(req, "report", 10, 60 * 60 * 1000, String(user._id));
  const input = await parseJson(req, reportCreateSchema);
  const report = await createReport(String(user._id), input as never);
  return ok({ id: String(report._id) }, { status: 201 });
});
