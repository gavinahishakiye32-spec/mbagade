import { handle, ok } from "@/lib/api";
import { listPublicOffers } from "@/services/offer.service";
import { connectDB } from "@/lib/mongodb";

/** Public offer discovery (addendum #14): feed-adjacent promotions browsing. */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const offers = await listPublicOffers({
    businessId: url.searchParams.get("businessId") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 30),
  });
  return ok({ offers });
});
