import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminManualBusinessSchema } from "@/lib/validation";
import { adminCreateBusiness } from "@/services/growth.service";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

/** Assisted onboarding: admin creates a business profile the owner claims later (addendum #9). */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(req, adminManualBusinessSchema);
  const business = await adminCreateBusiness(String(admin._id), input);
  await auditLog(String(admin._id), "business_manual_create", "business", String(business._id), { name: input.name });
  return ok({ id: String(business._id), username: business.username, claimStatus: business.claimStatus }, { status: 201 });
});
