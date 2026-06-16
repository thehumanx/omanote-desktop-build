import { SignUpButton } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui";

export function SignupScreen() {
  const navigate = useNavigate();
  return (
    <div className="public-page flex min-h-screen items-center justify-center bg-app-canvas px-4">
      <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-6 shadow-soft">
        <h1 className="text-2xl font-black text-app-ink">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Use Clerk to create your account. Google sign-in is configured from the Clerk dashboard.
        </p>
        <div className="mt-6 space-y-3">
          <SignUpButton mode="modal" fallbackRedirectUrl="/canvas">
            <Button className="w-full">Create account</Button>
          </SignUpButton>
          <Button tone="ghost" className="w-full" onClick={() => navigate("/login")}>
            Back to login
          </Button>
        </div>
      </div>
    </div>
  );
}
