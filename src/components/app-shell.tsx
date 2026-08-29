"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  PlusSquare,
  Radio,
  MessageCircle,
  Bell,
  Bookmark,
  ShoppingBag,
  LayoutDashboard,
  Shield,
  Search,
  CircleUserRound,
  Tag,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Badge, LinkButton, ToastHost } from "@/components/ui";
import { useSession } from "@/components/session-context";

function TopBar() {
  const { user } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary text-sm">B</span>
          BuyBuy
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/discover" aria-label="Search and discover" className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-text sm:hidden">
            <Search size={21} />
          </Link>
          {user ? (
            <>
              <Link href="/notifications" aria-label="Notifications" className="relative rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-text">
                <Bell size={21} />
              </Link>
              <Link href="/messages" aria-label="Messages" className="relative rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-text">
                <MessageCircle size={21} />
              </Link>
              <Link href={`/u/${user.username}`} aria-label="Your profile" className="ml-1">
                <Avatar src={user.avatarUrl} name={user.name} size={30} />
              </Link>
            </>
          ) : (
            <LinkButton href="/login" size="sm">Log in</LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, managedBusinesses } = useSession();
  const business = managedBusinesses[0] ?? null;
  const isAdmin = user?.role === "admin";

  const nav = [
    { href: "/", label: "Home", icon: Home },
    { href: "/reels", label: "Reels", icon: Clapperboard },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/offers", label: "Offers", icon: Tag },
    { href: "/create", label: "Create", icon: PlusSquare },
    { href: "/live", label: "Live", icon: Radio },
    { href: "/profile-menu", label: "Profile", icon: CircleUserRound, avatar: true },
  ];

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0">
      <TopBar />
      <main className="mx-auto max-w-6xl px-0 md:px-4">{children}</main>

      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-56 flex-col gap-1 border-r border-border bg-surface p-3 md:flex">
        {[
          { href: "/", label: "Home", icon: Home },
          { href: "/reels", label: "Reels", icon: Clapperboard },
          { href: "/discover", label: "Discover", icon: Compass },
          { href: "/offers", label: "Offers", icon: Tag },
          { href: "/live", label: "Live", icon: Radio },
          { href: "/saved", label: "Saved", icon: Bookmark },
          { href: "/orders", label: "Orders", icon: ShoppingBag },
          ...(business ? [{ href: `/dashboard/${business.id}`, label: "Dashboard", icon: LayoutDashboard }] : []),
          ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
        ].map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-text"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto border-t border-border pt-3">
          {user ? (
            <Link href={`/u/${user.username}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
              <Avatar src={user.avatarUrl} name={user.name} size={32} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted">@{user.username}</p>
              </div>
            </Link>
          ) : (
            <LinkButton href="/login" className="w-full">Log in</LinkButton>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-7">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon!;
            if ("avatar" in item && item.avatar) {
              return (
                <Link key={item.href} href={user ? `/u/${user.username}` : "/login"} className="flex flex-col items-center gap-0.5 py-2">
                  {user ? (
                    <Avatar src={user.avatarUrl} name={user.name} size={24} />
                  ) : (
                    <span className="text-muted"><Icon size={22} /></span>
                  )}
                  <span className={cn("text-[10px]", active ? "text-primary font-semibold" : "text-muted")}>{item.label}</span>
                </Link>
              );
            }
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2">
                <Icon size={22} className={active ? "text-primary" : "text-muted"} strokeWidth={active ? 2.4 : 2} />
                <span className={cn("text-[10px]", active ? "text-primary font-semibold" : "text-muted")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ToastHost />
    </div>
  );
}

export function VerifiedMark({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <Badge tone="primary">✓</Badge>
  );
}
