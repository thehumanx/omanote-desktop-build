import type { ReactNode } from "react";
import { isAllowedEmailDomain } from "@omanote/shared";
import { useAuth } from "../app/auth/AuthContext";
import { Button } from "./ui";

// Mirrors the server-side check in convex/utils.ts requireUserId — this gate
// just gives blocked users a clear message instead of a raw "Unauthorized"
// thrown from the first Convex call.
export function DomainGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  if (user && !isAllowedEmailDomain(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-canvas px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-2xl font-bold text-app-ink">Access restricted</p>
          <p className="text-sm text-app-ink-muted">
            omanote is currently only available to <strong>gmail.com</strong> accounts. You
            signed in as <strong>{user.email}</strong>.
          </p>
          <Button onClick={() => signOut()} className="mt-2">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
