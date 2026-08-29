import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { offerUpdateSchema } from "@/lib/validation";
import { updateOffer, deleteOffer } from "@/services/offer.service";
import { memberRole } from "@/services/business.service";
import { Offer } from "@/server/models";
import { ApiError } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

async function requireManageAccess(offerId: string) {
  const user = await requireUser();
  const offer = await Offer.findById(offerId).select("businessId").lean();
  if (!offer) throw new ApiError("NOT_FOUND", "Offer not found", 404);
  const access = await memberRole(user, String(offer.businessId));
  if (!access.canManage) throw new ApiError("FORBIDDEN", "You cannot manage this offer", 403);
  return user;
}

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  await requireManageAccess(id);
  const patch = await parseJson(req, offerUpdateSchema);
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) throw new ApiError("VALIDATION_ERROR", "businessId is required", 422);
  const offer = await updateOffer(businessId, id, patch);
  return ok({ id: String(offer._id) });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  await requireManageAccess(id);
  // resolve the owning business for the delete
  const offer = await Offer.findById(id).select("businessId").lean();
  if (!offer) throw new ApiError("NOT_FOUND", "Offer not found", 404);
  await deleteOffer(String(offer.businessId), id);
  return ok({ deleted: true });
});
