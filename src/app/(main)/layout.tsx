import { getAuthUser } from "@/lib/auth";
import { Business, BusinessMember } from "@/server/models/Business";
import { mediaUrl } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { SessionProvider, type ClientUser, type ManagedBusiness } from "@/components/session-context";

function toClientUser(u: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>): ClientUser {
  return {
    id: String(u._id),
    name: u.name,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarKey ? mediaUrl(u.avatarKey) : null,
    bio: u.bio,
    role: u.role,
    emailVerified: !!u.emailVerifiedAt,
  };
}

async function loadManaged(userId: string): Promise<ManagedBusiness[]> {
  const memberships = await BusinessMember.find({ userId }).lean();
  if (memberships.length === 0) return [];
  const businesses = await Business.find({ _id: { $in: memberships.map((m) => m.businessId) }, status: "active" })
    .select("name username logoKey verification category currency")
    .lean();
  return businesses.map((b) => {
    const m = memberships.find((x) => String(x.businessId) === String(b._id))!;
    const canManage = ["owner", "manager", "editor"].includes(m.role);
    return {
      id: String(b._id),
      name: b.name,
      username: b.username,
      logoUrl: b.logoKey ? mediaUrl(b.logoKey) : null,
      verified: b.verification === "verified",
      category: b.category,
      currency: b.currency ?? "USD",
      role: m.role,
      canManage,
    };
  });
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  const managedBusinesses = user ? await loadManaged(String(user._id)) : [];
  return (
    <SessionProvider user={user ? toClientUser(user) : null} managedBusinesses={managedBusinesses}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
