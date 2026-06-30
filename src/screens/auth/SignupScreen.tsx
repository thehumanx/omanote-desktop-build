import { SignUpButton } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui";
import { SeoHead } from "../../seo/SeoHead";

export function SignupScreen() {
  const navigate = useNavigate();
  return (
    <>
      <SeoHead
        title="Create your omanote account"
        description="Create your omanote account and start using your personal daily workspace for notes, todos, bookmarks, and events."
        canonical="https://omanote.com/signup"
      />
      <div className="public-page flex min-h-screen items-center justify-center bg-app-canvas px-4">
      <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-6 shadow-soft">
        <h1 className="text-2xl font-black text-app-ink">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Sign up with Google to get started with your personal daily workspace.
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
    </>
  );
}
