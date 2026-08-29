import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { productUpdateSchema } from "@/lib/validation";
import { updateProduct, deleteProduct, getProduct } from "@/services/product.service";
import { toProductSummary } from "@/services/view.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const result = await getProduct(id);
  if (!result) throw new ApiError("NOT_FOUND", "Product not found", 404);
  const { product, business } = result;
  return ok({
    product: {
      ...toProductSummary(product),
      kind: product.kind,
      description: product.description,
      imageUrls: (product.imageKeys ?? []).map((k) => `/api/media/${k}`),
      videoUrl: product.videoKey ? `/api/media/${product.videoKey}` : null,
      stock: product.stock,
      category: product.category,
      variants: product.variants ?? [],
      available: product.available && product.status === "active",
    },
    business: {
      id: String(business._id),
      name: business.name,
      username: business.username,
      logoUrl: business.logoKey ? `/api/media/${business.logoKey}` : null,
      verified: business.verification === "verified",
      city: business.city,
      country: business.country,
    },
  });
});

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const patch = await parseJson(req, productUpdateSchema);
  const product = await updateProduct(String(user._id), id, patch as never);
  return ok({ id: String(product._id) });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteProduct(String(user._id), id);
  return ok({ deleted: true });
});
