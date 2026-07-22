import { useMemo } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SeoHead } from "../seo/SeoHead";
import { useTopChrome } from "../components/layout/useTopChrome";
import { cn } from "../components/ui";
import {
  defaultGuideSlug,
  findGuideTopic,
  GUIDE_LAST_UPDATED,
  guideCategories,
  type GuideTopic,
} from "../content/guide/manifest";

// Prose styling for rendered markdown — mirrors the reader's article styles so
// guide content matches the rest of omanote without extra design work.
const PROSE_CLASS =
  "omanote-article max-w-2xl text-[15px] leading-7 text-app-ink " +
  "[&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight " +
  "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold " +
  "[&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-bold " +
  "[&_p]:my-3 [&_a]:text-info-ink [&_a]:underline " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 " +
  "[&_code]:rounded [&_code]:bg-app-surface-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] " +
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface-hover [&_pre]:p-3 " +
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-app-line [&_blockquote]:pl-4 [&_blockquote]:text-app-ink-muted " +
  "[&_strong]:font-semibold [&_strong]:text-app-ink [&_hr]:my-8 [&_hr]:border-app-line";

function TopicContent({ topic }: { topic: GuideTopic }) {
  if (!topic.body) {
    return (
      <div className="py-16 text-center text-app-ink-faint">
        <p className="text-sm">This guide is coming soon.</p>
        <p className="mt-1 text-xs">We're still writing it — check back shortly.</p>
      </div>
    );
  }
  return (
    <article className={PROSE_CLASS}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.body}</ReactMarkdown>
    </article>
  );
}

function GuideSidebarContents({ activeSlug }: { activeSlug: string }) {
  return (
    <>
      {guideCategories.map((category) => {
        const Icon = category.icon;
        return (
          <div key={category.id} className="mb-5">
            <div className="mb-1.5 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-app-ink-faint">
              <Icon className="h-3.5 w-3.5" />
              {category.title}
            </div>
            <ul>
              {category.topics.map((entry) => {
                const active = entry.slug === activeSlug;
                const unwritten = !entry.body;
                return (
                  <li key={entry.slug}>
                    <Link
                      to={`/guide/${entry.slug}`}
                      // Switching topics replaces the history entry instead of
                      // stacking one per click, so the close (X) button always
                      // exits the guide in one step instead of stepping back
                      // through previously viewed topics.
                      replace
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-1.5 text-sm transition",
                        active
                          ? "bg-app-surface-muted font-medium text-app-ink"
                          : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                        unwritten && !active && "text-app-ink-faint",
                      )}
                    >
                      {entry.title}
                      {unwritten ? <span className="ml-1.5 text-[10px] uppercase text-app-ink-faint">soon</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="mt-6 px-2 text-xs text-app-ink-faint">
        Updated {GUIDE_LAST_UPDATED}
      </p>
    </>
  );
}

function GuideBackLink() {
  return (
    <Link
      to="/guide"
      replace
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-app-ink-faint transition-colors hover:text-app-ink lg:hidden"
    >
      <ArrowLeft className="h-4 w-4" />
      All topics
    </Link>
  );
}

export function GuideScreen() {
  const { topic: slugParam } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  // Non-null only when rendered inside AppShell (see useTopChrome); the public
  // doc layout's Outlet passes no context, so this is a reliable signal.
  const isInAppShell = Boolean(useOutletContext<unknown>());

  const activeSlug = slugParam ?? defaultGuideSlug;
  const match = useMemo(() => findGuideTopic(activeSlug), [activeSlug]);
  const topic = match?.topic ?? null;

  // App-shell header (signed-in users). A no-op under the public doc layout,
  // which supplies its own "back to home" chrome instead. Title on the left,
  // last-updated badge on the right (mirrors the changelog version on /updates).
  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center justify-between gap-3">
        <h1 className="truncate text-lg font-bold text-app-ink">Guide</h1>
        <span className="inline-flex flex-none rounded-full border border-app-line bg-app-surface px-2.5 py-1 text-xs font-medium text-app-ink-muted">
          Updated {GUIDE_LAST_UPDATED}
        </span>
      </div>
    ),
    [],
  );
  useTopChrome(topChrome);

  // Unknown slug — send back to the guide home.
  if (slugParam && !match) {
    navigate("/guide", { replace: true });
    return null;
  }

  // Mobile drill-in: with a slug in the URL, show content; without, show the
  // topic list. Desktop always shows both panes.
  const hasTopic = Boolean(slugParam);

  const seoHead = (
    <SeoHead
      title={topic ? `${topic.title} — omanote guide` : "omanote guide"}
      description={topic?.description ?? "Learn how omanote works — the daily canvas, todos, notes, bookmarks, events, and more."}
      canonical={`https://omanote.com/guide${slugParam ? `/${slugParam}` : ""}`}
    />
  );

  if (isInAppShell) {
    // Matches NotesScreen/ReaderScreen exactly: a fixed pane pinned between the
    // top chrome and viewport bottom, with each column scrolling independently
    // so the divider between them spans the full height and touches the
    // header's bottom border with no stray top gap.
    return (
      <div
        className="fixed left-0 right-0 z-0 mx-auto flex min-h-0 flex-1 flex-col overflow-hidden md:px-4"
        style={{ top: "var(--omanote-top-chrome-height, 0px)", bottom: "0px", maxWidth: "1200px" }}
      >
        {seoHead}
        <div className="relative grid h-full min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[284px_minmax(0,1fr)]">
          <aside className={cn("h-full min-h-0 overflow-hidden pt-4", hasTopic ? "hidden lg:block" : "block")}>
            <nav className="scrollbar-hide h-full min-h-0 overflow-y-auto pb-16">
              <GuideSidebarContents activeSlug={activeSlug} />
            </nav>
          </aside>
          <section
            className={cn(
              "min-h-0 flex-1 flex-col overflow-y-auto pb-16 lg:flex lg:border-l lg:border-app-line lg:pl-4 lg:pt-4",
              hasTopic ? "flex" : "hidden lg:flex",
            )}
          >
            {hasTopic ? <GuideBackLink /> : null}
            {topic ? <TopicContent topic={topic} /> : null}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-1 sm:px-2">
      {seoHead}
      {/* No top padding on the grid so the sidebar/content divider reaches the
          sticky public nav's bottom border; each column pads its own content
          instead so the divider still runs flush at the top. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[268px_minmax(0,1fr)] lg:gap-8">
        {/* Left: category + topic tree */}
        <aside className={cn("lg:block", hasTopic ? "hidden" : "block")}>
          {/* top-14 matches PublicDocLayout's sticky nav height (h-14) so the
              sidebar doesn't stick underneath it while scrolling. */}
          <nav className="scrollbar-hide pt-6 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:pb-8">
            <GuideSidebarContents activeSlug={activeSlug} />
          </nav>
        </aside>

        {/* Right: content, divided from the sidebar on desktop. Border runs the
            full column height so it meets the nav's bottom border at the top. */}
        <section className={cn("min-w-0 pt-6 lg:border-l lg:border-app-line lg:pl-8", hasTopic ? "block" : "hidden lg:block")}>
          {hasTopic ? <GuideBackLink /> : null}
          {topic ? <TopicContent topic={topic} /> : null}
        </section>
      </div>
    </div>
  );
}
