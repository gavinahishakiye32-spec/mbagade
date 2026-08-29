import { Business, Product, Post } from "@/server/models";
import type { IBusiness, IProduct } from "@/types";
import { escapeRegExp } from "@/lib/utils";

export interface SearchResults {
  businesses: (IBusiness & { id: string })[];
  products: IProduct[];
  postsCount: number;
  total: number;
}

export async function search(q: string, opts: { category?: string; country?: string; city?: string; limit?: number }): Promise<SearchResults> {
  const limit = opts.limit ?? 20;
  const trimmed = q.trim();
  const rx = new RegExp(escapeRegExp(trimmed), "i");

  const businessFilter: Record<string, unknown> = { status: "active" };
  if (opts.category) businessFilter.category = opts.category;
  if (opts.country) businessFilter.country = opts.country;
  if (opts.city) businessFilter.city = opts.city;
  if (trimmed) {
    businessFilter.$or = [
      { name: rx },
      { username: rx },
      { description: rx },
      { category: rx },
      { city: rx },
      { country: rx },
      { subcategory: rx },
    ];
  }

  const [businesses, products, postsCount] = await Promise.all([
    Business.find(businessFilter).sort({ followersCount: -1 }).limit(limit).lean<IBusiness[]>(),
    trimmed
      ? Product.find({ status: "active", $or: [{ name: rx }, { description: rx }] }).sort({ ordersCount: -1 }).limit(limit).lean<IProduct[]>()
      : Promise.resolve([] as IProduct[]),
    trimmed ? Post.countDocuments({ status: "published", $or: [{ caption: rx }, { hashtags: trimmed.toLowerCase().replace("#", "") }] }) : Promise.resolve(0),
  ]);

  return {
    businesses: businesses.map((b) => ({ ...b, id: String(b._id) })),
    products,
    postsCount,
    total: businesses.length + products.length,
  };
}

export interface Suggestion {
  type: "business" | "category" | "product";
  label: string;
  value: string;
}

export async function suggest(q: string): Promise<Suggestion[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const rx = new RegExp(escapeRegExp(trimmed), "i");
  const [businesses, products] = await Promise.all([
    Business.find({ status: "active", name: rx }).select("name username").limit(5).lean(),
    Product.find({ status: "active", name: rx }).select("name").limit(4).lean(),
  ]);
  return [
    ...businesses.map((b) => ({ type: "business" as const, label: b.name, value: `/businesses/${b.username}` })),
    ...products.map((p) => ({ type: "product" as const, label: p.name, value: `/search?q=${encodeURIComponent(p.name)}` })),
  ];
}
