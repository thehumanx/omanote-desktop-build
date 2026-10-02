import { currentVersion as bundledVersion } from "virtual:changelog";

/**
 * Read once at module load: the changelog is bundled at build time, so the
 * badge always shows whatever actually shipped last without any plumbing.
 */
const currentVersion = bundledVersion?.version ?? "v0.9";

/**
 * The landing page's headline, in one place.
 *
 * Two surfaces render it: the pinned tour's hero and the stacked
 * reduced-motion variant. They differ only in type scale, so the words live
 * here and the caller passes the sizing — otherwise every copy change is two
 * edits and they drift apart.
 *
 * The eyebrow pairs a short tagline with the live version so the claim up here
 * isn't taken on faith alone — the version number says the thing is real and
 * still moving.
 *
 * Set in the sans stack, heavy and tight, rather than the serif the rest of
 * the page's headings use: it sits on the dotted green panel as the one
 * poster-sized line on the page.
 */
export function LandingHeroCopy({ headingClassName = "" }: { headingClassName?: string }) {
  return (
    <>
      <p className="inline-flex items-center rounded-full bg-app-surface px-3.5 py-1.5 text-[11px] font-bold uppercase text-app-ink shadow-sm">
        A canvas for your thoughts · {currentVersion}
      </p>
      <h1
        className={`mt-6 max-w-[900px] font-black leading-[1.02] tracking-tight text-app-ink ${headingClassName}`}
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
