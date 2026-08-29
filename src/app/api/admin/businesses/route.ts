import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminBusinessActionSchema } from "@/lib/validation";
import { Business, Post } from "@/server/models";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const verification = url.searchParams.get("verification");

  const filter: Record<string, unknown> = {};
  if (verification) filter.verification = verification;
  if (q) filter.$or = [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { username: q.toLowerCase() }];

  const businesses = await Business.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  return ok({
    items: businesses.map((b) => ({
      id: String(b._id),
      name: b.name,
      username: b.username,
      category: b.category,
      country: b.country,
      city: b.city,
      verification: b.verification,
      status: b.status,
      followersCount: b.followersCount,
      founding: b.isFoundingBusiness,
      claimStatus: b.claimStatus,
      createdAt: b.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(req, adminBusinessActionSchema.extend({ businessId: z.string().min(1).max(64) }));

  const business = await Business.findById(input.businessId);
  if (!business) throw new Error("NOT_FOUND");

  switch (input.action) {
    case "verify":
      business.verification = "verified";
      business.verifiedAt = new Date();
      break;
    case "reject_verification":
      business.verification = "rejected";
      break;
    case "suspend":
      business.status = "suspended";
      // suspend hides content
      await Post.updateMany({ businessId: business._id, status: "published" }, { status: "under_review" });
      break;
    case "activate":
      business.status = "active";
      await Post.updateMany({ businessId: business._id, status: "under_review", "moderation.flagged": { $ne: true } }, { status: "published" });
      break;
    case "grant_founding_business":
      business.isFoundingBusiness = true;
      business.foundingBusinessAt = new Date();
      break;
    case "revoke_founding_business":
      business.isFoundingBusiness = false;
      business.foundingBusinessAt = null;
      break;
  }
  await business.save();

  await auditLog(String(admin._id), `business.${input.action}`, "business", String(business._id), { reason: input.reason ?? "" });
  return ok({ verification: business.verification, status: business.status, founding: business.isFoundingBusiness });
});
