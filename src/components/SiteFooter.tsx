import { Link } from "react-router-dom";
import { currentVersion as bundledVersion } from "virtual:changelog";

const currentVersion = bundledVersion?.version ?? "v0.9";
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

/**
 * The public site's footer: landing, privacy and terms.
 *
 * One component so the pages can't drift — privacy and terms used to carry
 * their own hand-copied older layout, which fell behind every time the
 * landing footer changed.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
          {/* Left: identity, blurbs, copyright — all text copy lives here. */}
          <div>
            <div className="flex items-center gap-2">
              <Link to="/">
                <img src="/logo.svg" alt="omanote home" className="h-5 w-auto" />
              </Link>
              <Link
                to="/updates"
                className="rounded-full border border-app-line bg-app-canvas px-2 py-0.5 text-[10px] font-bold text-app-ink-muted hover:border-app-line-strong hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out cursor-pointer"
              >
                {currentVersion}
              </Link>
            </div>
            <p className="mt-2.5 text-xs text-app-ink-faint leading-relaxed max-w-[300px]">
              Personal notetaking app of{" "}
              <a
                href="https://iambishistha.com"
                target="_blank"
                rel="noopener noreferrer"
                className="omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                iambishistha.com
              </a>
              .
              <span className="block">Built for personal use, shared publicly.</span>
            </p>
            <p className="mt-3 text-xs text-app-ink-faint">© {year} omanote. All rights reserved.</p>
          </div>
    
          {/* Right: link groups only. */}
          <div className="flex gap-12">
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase text-app-ink-faint">Product</p>
              <a
                href="https://omanote.com/s/FeUM44Rd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Roadmap
              </a>
              <Link
                to="/guide"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Guide
              </Link>
              <Link
                to="/updates"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Changelog
              </Link>
              <a
                href={desktopAppReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Desktop app
              </a>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase text-app-ink-faint">Legal</p>
              <Link
                to="/privacy"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-xs text-app-ink-faint omanote-link hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
