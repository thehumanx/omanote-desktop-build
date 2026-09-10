import changelogMarkdown from "../../../CHANGELOG.md?raw";
import { parseLatestVersion } from "../../lib/update-checker";

/**
 * Read once at module load: the changelog is bundled at build time, so the
 * badge always shows whatever actually shipped last without any plumbing.
 */
const currentVersion = parseLatestVersion(changelogMarkdown)?.version ?? "v0.9";

/**
 * The landing page's headline, in one place.
 *
 * Three surfaces render it: the pinned tour's fading hero, the stacked
 * reduced-motion variant, and the mobile fallback. They differ only in type
 * scale, so the words live here and the caller passes the sizing — otherwise
 * every copy change is three edits and they drift apart.
 *
 * The eyebrow pairs a short tagline with the live version so the claim up here
 * isn't taken on faith alone — the version number says the thing is real and
 * still moving.
 */
export function LandingHeroCopy({ headingClassName = "" }: { headingClassName?: string }) {
  return (
    <>
      <p className="inline-flex items-center rounded-full border border-app-line bg-app-canvas px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-app-ink-muted">
        A canvas for your thoughts · {currentVersion}
      </p>
      <h1
        className={`font-serif-heading mt-6 max-w-[900px] font-black leading-[1.02] ${headingClassName}`}
      >
        Thoughts arrive small.
        <br className="hidden sm:block" /> Catch them that way.
      </h1>
      <p className="mt-5 max-w-[520px] text-md leading-relaxed text-app-ink-muted">
        A place to dump your daily thoughts, todos, bookmarks and events. <br/> Plus some quality of life features you'd love.
      </p>
    </>
  );
}
