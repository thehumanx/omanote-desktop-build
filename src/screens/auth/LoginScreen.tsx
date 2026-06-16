import { SignInButton, SignUpButton } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui";

export function LoginScreen() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/canvas";

  return (
    <div className="public-page flex min-h-screen items-center justify-center bg-app-canvas px-4">
      <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-ink-muted">omanote</p>
        <h1 className="mt-2 text-2xl font-black text-app-ink">Sign in to your canvas</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Sign in with Google through Clerk. Once authenticated, you’ll land back in omanote.
        </p>
        <div className="mt-6 space-y-3">
          <SignInButton mode="modal" fallbackRedirectUrl={from}>
            <Button className="w-full">Continue with Google</Button>
          </SignInButton>
          <SignUpButton mode="modal" fallbackRedirectUrl="/canvas">
            <Button tone="soft" className="w-full">Create account</Button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
