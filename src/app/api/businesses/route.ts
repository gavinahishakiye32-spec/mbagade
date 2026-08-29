import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createBusinessSchema, businessQuerySchema } from "@/lib/validation";
import { createBusiness } from "@/services/business.service";
import { Business } from "@/server/models";
import type { IBusiness } from "@/types";
import { connectDB } from "@/lib/mongodb";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

/** GET /api/businesses — public directory with filters. */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const query = businessQuerySchema.parse(Object.fromEntries(url.searchParams));

  const filter: Record<string, unknown> = { status: "active" };
  if (query.category) filter.category = query.category;
  if (query.country) filter.country = query.country;
  if (query.city) filter.city = query.city;
  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { username: rx }, { description: rx }, { category: rx }];
  }
  if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };

  const sort: Record<string, 1 | -1> =
    query.sort === "followers" ? { followersCount: -1 } : query.sort === "rating" ? { ratingAvg: -1 } : { createdAt: -1 };

  const items = await Business.find(filter).sort(sort).limit(query.limit + 1).lean<IBusiness[]>();
  const hasMore = items.length > query.limit;
  const page = items.slice(0, query.limit);

  return ok({
    items: page.map((b) => ({
      id: String(b._id),
      username: b.username,
      name: b.name,
      description: b.description.slice(0, 160),
      logoUrl: b.logoKey ? `/api/media/${b.logoKey}` : null,
      coverUrl: b.coverKey ? `/api/media/${b.coverKey}` : null,
      category: b.category,
      city: b.city,
      country: b.country,
      verified: b.verification === "verified",
      followersCount: b.followersCount,
      ratingAvg: b.ratingAvg,
      reviewsCount: b.reviewsCount,
      createdAt: b.createdAt.toISOString(),
    })),
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  });
});

/** POST /api/businesses — create a business (authenticated). */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, createBusinessSchema);
  const business = await createBusiness(user, input as never);
  return ok({
    id: String(business._id),
    username: business.username,
    name: business.name,
  });
});
