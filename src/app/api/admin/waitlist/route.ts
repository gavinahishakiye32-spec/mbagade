import { handle, ok, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { WaitlistEntry } from "@/server/models";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const filter: Record<string, string> = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  const entries = await WaitlistEntry.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return ok({
    items: entries.map((e) => ({
      id: String(e._id),
      type: e.type,
      name: e.name,
      email: e.email,
      phone: e.phone,
      country: e.country,
      city: e.city,
      businessName: e.businessName,
      category: e.category,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

/** Mark an entry as invited (part of the pre-launch funnel). */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) throw new ApiError("VALIDATION_ERROR", "Entry id required", 422);

  const entry = await WaitlistEntry.findByIdAndUpdate(id, { $set: { status: "invited" } }, { new: true });
  if (!entry) throw new ApiError("NOT_FOUND", "Waitlist entry not found", 404);

  await auditLog(String(admin._id), "waitlist_mark_invited", "waitlist_entry", entry._id, { email: entry.email });
  return ok({ id: String(entry._id), status: entry.status });
});
