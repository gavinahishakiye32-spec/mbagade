import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser, toSafeUser } from "@/lib/auth";
import { User, Post, Follow } from "@/server/models";
import { Business, BusinessMember } from "@/server/models/Business";
import { Avatar, Badge } from "@/components/ui";
import { UserFollowButton } from "@/components/user/user-follow-button";
import { formatCount, timeAgo, mediaUrl } from "@/lib/utils";

interface Props {
  params: Promise<{ username: string }>;
}

async function loadUser(username: string) {
  return User.findOne({ username: username.toLowerCase(), deletedAt: null }).lean();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await loadUser(username);
  if (!user) return { title: "User not found" };
  return { title: `${user.name} (@${user.username})` };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await loadUser(username);
  if (!user || user.status === "banned") notFound();

  const safe = toSafeUser(user);
  const viewer = await getAuthUser();
  const isSelf = viewer && String(viewer._id) === String(user._id);

  const [memberships, followingCount, posts, viewerFollowing] = await Promise.all([
    BusinessMember.find({ userId: user._id }).lean(),
    Follow.countDocuments({ userId: user._id }),
    Post.find({ authorType: "user", authorUserId: user._id, status: "published" })
      .sort({ createdAt: -1 })
      .limit(60)
      .select("_id type mediaKeys thumbnailKey caption")
      .lean(),
    viewer ? Follow.exists({ userId: viewer._id, followedUserId: user._id, followingType: "user" }) : Promise.resolve(false),
  ]);

  const ownedBusinesses = memberships.length
    ? await Business.find({ _id: { $in: memberships.map((m) => m.businessId) }, status: "active" }).lean()
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-start gap-4">
        <Avatar src={safe.avatarKey ? mediaUrl(safe.avatarKey) : null} name={safe.name} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{safe.name}</h1>
            {safe.role === "admin" && <Badge tone="warning">Admin</Badge>}
          </div>
          <p className="text-sm text-muted">@{safe.username}</p>
          {safe.bio && <p className="mt-1.5 whitespace-pre-wrap text-sm">{safe.bio}</p>}
          <p className="mt-1 text-xs text-muted">Joined {timeAgo((user.createdAt as Date).toISOString())}</p>
        </div>
        {isSelf ? (
          <Link href="/settings" className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
            Edit profile
          </Link>
        ) : (
          viewer && <UserFollowButton username={safe.username} initial={Boolean(viewerFollowing)} />
        )}
      </div>

      <div className="mt-4 flex gap-5 text-sm text-muted">
        <span><strong className="text-text">{formatCount(user.followersCount ?? 0)}</strong> followers</span>
        <span><strong className="text-text">{followingCount}</strong> following</span>
        <span><strong className="text-text">{posts.length}</strong> posts</span>
        {ownedBusinesses.length > 0 && (
          <span><strong className="text-text">{ownedBusinesses.length}</strong> businesses</span>
        )}
      </div>

      {posts.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Posts</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p) => (
              <Link key={String(p._id)} href={`/p/${String(p._id)}`} className="aspect-square overflow-hidden rounded-lg bg-surface-2">
                {p.type === "text" ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/20 p-2">
                    <p className="line-clamp-3 text-center text-[11px] font-semibold">{p.caption}</p>
                  </div>
                ) : p.mediaKeys?.[0] || p.thumbnailKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(p.mediaKeys?.[0] ?? p.thumbnailKey!) ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted">•</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {ownedBusinesses.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Businesses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownedBusinesses.map((b) => (
              <Link key={String(b._id)} href={`/b/${b.username}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-primary">
                <Avatar src={b.logoKey ? mediaUrl(b.logoKey) : null} name={b.name} size={44} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    {b.name}
                    {b.verification === "verified" && <span className="text-primary">✓</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{formatCount(b.followersCount ?? 0)} followers</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
