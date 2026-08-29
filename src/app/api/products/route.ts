import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { productCreateSchema } from "@/lib/validation";
import { createProduct, listProducts } from "@/services/product.service";
import { BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const result = await listProducts({
    businessId: url.searchParams.get("businessId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    kind: (url.searchParams.get("kind") as "product" | "service") ?? undefined,
    cursor: url.searchParams.get("cursor"),
    limit: Math.min(Number(url.searchParams.get("limit") ?? 12), 50),
  });
  return ok({
    items: result.items.map((p) => ({
      id: String(p._id),
      kind: p.kind,
      name: p.name,
      description: p.description.slice(0, 200),
      imageUrl: p.imageKeys?.[0] ? `/api/media/${p.imageKeys[0]}` : null,
      priceCents: p.priceCents,
      currency: p.currency,
      stock: p.stock,
      category: p.category,
      available: p.available && p.status === "active",
      businessId: String(p.businessId),
    })),
    nextCursor: result.nextCursor,
  });
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
  const input = await parseJson(req, productCreateSchema);
  const product = await createProduct(String(user._id), businessId, input as never);
  return ok({ id: String(product._id) }, { status: 201 });
});
