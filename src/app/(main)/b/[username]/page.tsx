import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getBusinessByUsername, isFollowing, listReviews, memberRole } from "@/services/business.service";
import { listBusinessProducts } from "@/services/product.service";
import { Post } from "@/server/models";
import { toPostView } from "@/services/view.service";
import { categoryName } from "@/config/categories";
import { mediaUrl } from "@/lib/utils";
import { BusinessProfile } from "@/components/business/business-profile";
import type { IBusiness, IPost } from "@/types";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const business = await getBusinessByUsername(username.toLowerCase());
  if (!business) return { title: "Business not found" };
  return {
    title: business.name,
    description: business.description?.slice(0, 150) ?? undefined,
  };
}

export default async function BusinessPage({ params }: Props) {
  const { username } = await params;
  const business = await getBusinessByUsername(username.toLowerCase());
  if (!business || business.status === "suspended") notFound();

  const businessId = String(business._id);
  const viewer = await getAuthUser();
  const viewerId = viewer ? String(viewer._id) : null;

  const [following, products, reviews, rawPosts, role] = await Promise.all([
    viewerId ? isFollowing(viewerId, businessId) : Promise.resolve(false),
    listBusinessProducts(businessId),
    listReviews(businessId, null, 10),
    Post.find({ businessId: business._id, status: "published" })
      .sort({ createdAt: -1 })
      .limit(24)
      .lean<IPost[]>(),
    memberRole(viewer ?? null, businessId),
  ]);

  const posts = rawPosts.map((p) =>
    toPostView(p, business as unknown as IBusiness, {
      viewerId,
      likedIds: new Set<string>(),
      savedIds: new Set<string>(),
      followedBusinessIds: new Set(following ? [businessId] : []),
      followedUserIds: new Set<string>(),
    })
  );

  return (
    <BusinessProfile
      business={{
        id: businessId,
        name: business.name,
        username: business.username,
        logoUrl: business.logoKey ? mediaUrl(business.logoKey) : null,
        coverUrl: business.coverKey ? mediaUrl(business.coverKey) : null,
        description: business.description ?? "",
        category: categoryName(business.category),
        city: business.city ?? null,
        country: business.country ?? null,
        verified: business.verification === "verified",
        website: business.website ?? null,
        phone: business.phone ?? null,
        rating: Math.round((business.ratingAvg ?? 0) * 10) / 10,
        ratingCount: business.reviewsCount ?? 0,
        followersCount: business.followersCount ?? 0,
        createdAt: (business.createdAt as Date).toISOString(),
        currency: business.currency ?? "USD",
        founding: Boolean(business.isFoundingBusiness),
        claimable: !role.canManage && (business.claimStatus === "unclaimed" || business.claimStatus === "n/a"),
      }}
      viewer={{ following, canManage: role.canManage, loggedIn: !!viewer }}
      initialPosts={posts}
      products={products.map((p) => ({
        id: String(p._id),
        name: p.name,
        priceCents: p.priceCents,
        currency: p.currency,
        imageUrl: p.imageKeys[0] ? mediaUrl(p.imageKeys[0]) : null,
        inStock: p.available && p.status === "active" && (p.stock === null || p.stock > 0),
      }))}
      reviews={reviews.items}
    />
  );
}
