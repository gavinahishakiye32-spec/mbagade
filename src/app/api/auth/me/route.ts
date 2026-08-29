import { handle, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { BusinessMember, Business } from "@/server/models";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  const user = await getAuthUser();
  if (!user) return ok({ user: null, managedBusinesses: [] });

  const memberships = await BusinessMember.find({ userId: user._id }).select("businessId role").lean();
  const businesses = await Business.find({ _id: { $in: memberships.map((m) => m.businessId) } })
    .select("name username logoKey verification category currency")
    .lean();

  const managedBusinesses = businesses.map((b) => ({
    id: String(b._id),
    name: b.name,
    username: b.username,
    logoUrl: b.logoKey ? `/api/media/${b.logoKey}` : null,
    verified: b.verification === "verified",
    category: b.category,
    currency: b.currency,
    role: memberships.find((m) => String(m.businessId) === String(b._id))?.role ?? null,
  }));

  return ok({ user, managedBusinesses });
});
