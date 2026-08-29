import { Types, QueryFilter } from "mongoose";
import { Product, Business, BusinessMember } from "@/server/models";
import type { IProduct } from "@/types";
import { ApiError } from "@/lib/api";


export interface ProductInput {
  kind: "product" | "service";
  name: string;
  description: string;
  imageKeys: string[];
  videoKey?: string;
  priceCents: number;
  currency: string;
  stock?: number | null;
  category: string;
  variants?: { name: string; options: string[] }[];
  available: boolean;
}

export async function createProduct(userId: string, businessId: string, input: ProductInput): Promise<IProduct> {
  const member = await BusinessMember.exists({ businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  const product = await Product.create({
    ...input,
    businessId: new Types.ObjectId(businessId),
    stock: input.kind === "service" ? null : (input.stock ?? null),
    videoKey: input.videoKey ?? null,
  });
  await Business.updateOne({ _id: businessId }, { $inc: { productsCount: 1 } });
  return product.toObject() as IProduct;
}

export async function updateProduct(userId: string, productId: string, patch: Partial<ProductInput> & { status?: "active" | "hidden" }): Promise<IProduct> {
  const product = await Product.findById(productId);
  if (!product || product.status === "removed") throw new ApiError("NOT_FOUND", "Product not found", 404);

  const member = await BusinessMember.exists({ businessId: product.businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  Object.assign(product, patch);
  if (patch.kind === "service") product.stock = null;
  await product.save();
  return product.toObject() as IProduct;
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError("NOT_FOUND", "Product not found", 404);
  const member = await BusinessMember.exists({ businessId: product.businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  product.status = "removed";
  await product.save();
  await Business.updateOne({ _id: product.businessId }, { $inc: { productsCount: -1 } });
}

export async function getProduct(productId: string): Promise<{ product: IProduct; business: import("@/types").IBusiness } | null> {
  if (!Types.ObjectId.isValid(productId)) return null;
  const product = await Product.findOne({ _id: productId, status: { $ne: "removed" } }).lean<IProduct | null>();
  if (!product) return null;
  const business = await Business.findById(product.businessId).lean();
  if (!business) return null;
  return { product, business };
}

export async function listProducts(opts: {
  businessId?: string;
  q?: string;
  category?: string;
  kind?: "product" | "service";
  cursor?: string | null;
  limit: number;
}): Promise<{ items: IProduct[]; nextCursor: string | null }> {
  const filter: QueryFilter<IProduct> = { status: "active" };
  if (opts.businessId) filter.businessId = opts.businessId;
  if (opts.category) filter.category = opts.category;
  if (opts.kind) filter.kind = opts.kind;
  if (opts.cursor) filter._id = { $lt: new Types.ObjectId(opts.cursor) };
  if (opts.q) filter.$text = { $search: opts.q };

  const items = await Product.find(filter)
    .sort(opts.q ? { score: { $meta: "textScore" } } : { createdAt: -1 })
    .limit(opts.limit + 1)
    .lean<IProduct[]>();

  const hasMore = items.length > opts.limit;
  return { items: items.slice(0, opts.limit), nextCursor: hasMore ? String(items[opts.limit - 1]._id) : null };
}

export async function listBusinessProducts(businessId: string): Promise<IProduct[]> {
  return Product.find({ businessId, status: { $ne: "removed" } }).sort({ createdAt: -1 }).limit(200).lean<IProduct[]>();
}
