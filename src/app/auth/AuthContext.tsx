import React, { createContext, useContext, useMemo } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/react";

interface AuthContextValue {
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
    provider: "clerk";
  } | null;
  signOut: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, signOut } = useClerkAuth();
  const { user } = useUser();

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isSignedIn && user
        ? {
            id: user.id,
            name: user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "User",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            imageUrl: user.imageUrl ?? null,
            provider: "clerk" as const,
          }
        : null,
      signOut: () => signOut(),
      deleteAccount: async () => {
        if (!user) {
          throw new Error("No authenticated user");
        }
        await user.delete();
      },
    }),
    [isSignedIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
