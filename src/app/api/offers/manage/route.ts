import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { offerCreateSchema } from "@/lib/validation";
import { createOffer, listBusinessOffers } from "@/services/offer.service";
import { memberRole } from "@/services/business.service";
import { BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  let businessId = url.searchParams.get("businessId");
  if (!businessId || !/^[a-f0-9]{24}$/i.test(businessId)) {
    const membership = await BusinessMember.findOne({ userId: user._id }).lean();
    if (!membership) throw new ApiError("FORBIDDEN", "Create or join a business first", 403);
    businessId = String(membership.businessId);
  }
  const access = await memberRole(user, businessId);
  if (!access.canManage) throw new ApiError("FORBIDDEN", "You cannot manage offers for this business", 403);

  const offers = await listBusinessOffers(businessId);
  return ok({ offers });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  let businessId = url.searchParams.get("businessId");
  if (!businessId || !/^[a-f0-9]{24}$/i.test(businessId)) {
    const membership = await BusinessMember.findOne({ userId: user._id }).lean();
    if (!membership) throw new ApiError("FORBIDDEN", "Create or join a business first", 403);
    businessId = String(membership.businessId);
  }
  const access = await memberRole(user, businessId);
  if (!access.canManage) throw new ApiError("FORBIDDEN", "You cannot manage offers for this business", 403);

  const input = await parseJson(req, offerCreateSchema);
  const offer = await createOffer(businessId, input);
  return ok({ id: String(offer._id) }, { status: 201 });
});
