import { handle, ok } from "@/lib/api";
import { search, suggest } from "@/services/search.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const suggestOnly = url.searchParams.get("suggest") === "1";

  if (suggestOnly) return ok({ suggestions: await suggest(q) });

  const results = await search(q, {
    category: url.searchParams.get("category") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
  });

  return ok({
    businesses: results.businesses.map((b) => ({
      id: String(b._id),
      username: b.username,
      name: b.name,
      description: b.description.slice(0, 160),
      logoUrl: b.logoKey ? `/api/media/${b.logoKey}` : null,
      category: b.category,
      city: b.city,
      country: b.country,
      verified: b.verification === "verified",
      followersCount: b.followersCount,
      ratingAvg: b.ratingAvg,
    })),
    products: results.products.map((p) => ({
      id: String(p._id),
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      imageUrl: p.imageKeys?.[0] ? `/api/media/${p.imageKeys[0]}` : null,
      businessId: String(p.businessId),
    })),
    postsCount: results.postsCount,
  });
});
