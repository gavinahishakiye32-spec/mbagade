import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser, getAuthUser } from "@/lib/auth";
import { updateBusinessSchema } from "@/lib/validation";
import { getBusinessByUsername, getBusinessById, updateBusiness, isFollowing } from "@/services/business.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

async function resolveBusiness(idOrUsername: string) {
  const business = idOrUsername.match(/^[a-f0-9]{24}$/i)
    ? await getBusinessById(idOrUsername)
    : await getBusinessByUsername(idOrUsername);
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  return business;
}

/** GET /api/businesses/[idOrUsername] — public profile. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const business = await resolveBusiness(id);
  const viewer = await getAuthUser();

  return ok({
    business: {
      id: String(business._id),
      username: business.username,
      name: business.name,
      description: business.description,
      logoUrl: business.logoKey ? `/api/media/${business.logoKey}` : null,
      coverUrl: business.coverKey ? `/api/media/${business.coverKey}` : null,
      category: business.category,
      subcategory: business.subcategory,
      country: business.country,
      region: business.region,
      city: business.city,
      address: business.address,
      phone: business.phone,
      email: business.email,
      whatsapp: business.whatsapp,
      website: business.website,
      socialLinks: business.socialLinks ?? [],
      openingHours: business.openingHours ?? null,
      verification: business.verification,
      followersCount: business.followersCount,
      postsCount: business.postsCount,
      productsCount: business.productsCount,
      ratingAvg: business.ratingAvg,
      reviewsCount: business.reviewsCount,
      allowCalls: business.allowCalls,
      allowOrders: business.allowOrders,
      currency: business.currency,
      createdAt: business.createdAt.toISOString(),
    },
    viewerFollowing: viewer ? await isFollowing(String(viewer._id), String(business._id)) : false,
  });
});

/** PATCH /api/businesses/[id] — update (owner/manager/admin only). */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const patch = await parseJson(req, updateBusinessSchema);
  const updated = await updateBusiness(user, id, patch as Record<string, unknown>);
  return ok({ id: String(updated._id), username: updated.username });
});
