"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionWithProfile } from "./types";

const UserContext = createContext<SessionWithProfile | null>(null);

export function UserProvider({
  session,
  children,
}: {
  session: SessionWithProfile;
  children: ReactNode;
}) {
  return <UserContext.Provider value={session}>{children}</UserContext.Provider>;
}

export function useUser(): SessionWithProfile {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}
