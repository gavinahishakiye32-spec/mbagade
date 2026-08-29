import type { SafeUser } from "@/types";
import { objectIdEquals } from "@/lib/mongodb";

export interface BusinessAccess {
  isOwner: boolean;
  role: "owner" | "manager" | "editor" | null;
  canManage: boolean; // edit profile, products, posts
  canModerate: boolean; // respond to customers (messages), view analytics
}

/** Determines what the user can do with a business. Membership is checked in DB by the service layer. */
export function businessAccessFor(user: SafeUser | null, memberRole: string | null, ownerUserId: string): BusinessAccess {
  if (!user) return { isOwner: false, role: null, canManage: false, canModerate: false };
  if (user.role === "admin") return { isOwner: true, role: "owner", canManage: true, canModerate: true };
  if (objectIdEquals(user._id, ownerUserId)) return { isOwner: true, role: "owner", canManage: true, canModerate: true };
  if (memberRole === "owner") return { isOwner: true, role: "owner", canManage: true, canModerate: true };
  if (memberRole === "manager") return { isOwner: false, role: "manager", canManage: true, canModerate: true };
  if (memberRole === "editor") return { isOwner: false, role: "editor", canManage: true, canModerate: false };
  return { isOwner: false, role: null, canManage: false, canModerate: false };
}
