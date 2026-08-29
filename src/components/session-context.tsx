"use client";

import { createContext, useContext } from "react";

/** Client-safe user shape (serialized, no ObjectIds/keys). */
export interface ClientUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  role: "customer" | "business" | "admin";
  emailVerified: boolean;
}

export interface ManagedBusiness {
  id: string;
  name: string;
  username: string;
  logoUrl: string | null;
  verified: boolean;
  category: string;
  currency: string;
  role: string | null;
  canManage: boolean;
}

interface SessionContextValue {
  user: ClientUser | null;
  managedBusinesses: ManagedBusiness[];
}

const SessionContext = createContext<SessionContextValue>({ user: null, managedBusinesses: [] });

export function SessionProvider({
  user,
  managedBusinesses,
  children,
}: SessionContextValue & { children: React.ReactNode }) {
  return <SessionContext.Provider value={{ user, managedBusinesses }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
