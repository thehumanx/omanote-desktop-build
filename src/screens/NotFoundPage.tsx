import { Link } from "react-router-dom";
import { SeoHead } from "../seo/SeoHead";

export function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="Page Not Found | omanote"
        description="The page you're looking for doesn't exist or has been moved."
        canonical="https://omanote.com/"
      />
      <div className="public-page flex min-h-screen flex-col items-center justify-center gap-6 bg-app-canvas px-4">
      <Link to="/" className="flex items-center transition hover:opacity-70">
        <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
      </Link>
      <div className="text-center">
        <p className="text-5xl font-bold text-app-line-strong">404</p>
        <p className="mt-3 text-base font-medium text-app-ink">Page not found</p>
        <p className="mt-1 text-sm text-app-ink-faint">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link
        to="/"
        className="omanote-button-chrome inline-flex items-center justify-center rounded-app-button px-app-field-x py-app-field-y text-sm font-bold text-action-primary-ink transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-app-fast ease-app-out active:translate-y-px active:scale-[0.98]"
      >
        Go home
      </Link>
    </div>
    </>
  );
}
