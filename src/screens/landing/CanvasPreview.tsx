import { useEffect, useMemo, useRef } from "react";
import { User } from "lucide-react";
import { CanvasDateRow, formatTodayLabel } from "../../components/CanvasDateRow";
import { CanvasDayArtifacts } from "../../components/CanvasDayArtifacts";
import { CanvasOverdueSection } from "../../components/CanvasOverdueSection";
import { CanvasSystemNoticeView } from "../../components/CanvasSystemNotice";
import { CanvasWeekAtGlanceView } from "../../components/CanvasWeekAtGlance";
import { UpdateNotificationRow } from "../../components/UpdateNotificationBanner";
import { SurveyPrompt } from "../../components/survey/SurveyPrompt";
import { CanvasContinueWritingView } from "../../components/page/CanvasContinueWriting";
import { StaticUserSettingsProvider } from "../../contexts/UserSettingsContext";
import {
  PREVIEW_CANVAS_ITEMS,
  PREVIEW_CATEGORY_NAME_BY_ID,
  PREVIEW_NOTE_FOLDERS,
  PREVIEW_OVERDUE_TODOS,
  PREVIEW_PAGES,
  PREVIEW_TODAY_KEY,
  PREVIEW_UPDATE,
  PREVIEW_WEEK_AT_GLANCE,
  previewGreeting,
} from "./canvas-preview-data";
import { PreviewChrome } from "./PreviewChrome";
import { useRoadmapPreviewTodos } from "./use-roadmap-preview";
import type { CanvasArtifactItem } from "../../app/reducer";

const noop = () => {};

/** Matches AppShell: every route shares one centred 1024px content column. */
const CONTENT_COLUMN = "mx-auto w-full max-w-[1024px] px-4";

/**
 * Blocks interaction with the whole preview subtree.
 *
 * `pointer-events-none` alone stops the mouse but leaves every button and
 * link in the tab order, so a keyboard visitor could tab into a fake canvas
 * and "open" a page that doesn't exist. `inert` handles pointer, focus, and
 * the accessibility tree in one go, but React 18 doesn't recognise it as a
 * JSX prop, so it goes on via a ref.
 */
function useInert<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.setAttribute("inert", "");
  }, []);
  return ref;
}

/** Stand-in for ProfileMenuButton, which needs Clerk and the settings drawer. */
function PreviewAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface-muted text-app-ink-faint">
      <User className="h-4 w-4" />
    </span>
  );
}

/** The app's header row: date on the left, avatar on the right. */
function PreviewTopBar() {
  return (
    <div className="border-b border-app-line bg-app-surface">
      <div className={`${CONTENT_COLUMN} flex h-[58px] items-center justify-between gap-3`}>
        <div className="min-w-0 flex-1">
          {/* The anchor hugs the date control itself. On the full-width bar a
              tooltip would centre on the screen, pointing at empty space
              rather than at the date. */}
          <span data-tour-anchor="date" className="inline-block">
            <CanvasDateRow label={formatTodayLabel(new Date())} mode="enter" onToggle={noop} />
          </span>
        </div>
        <PreviewAvatar />
      </div>
    </div>
  );
}

/**
 * A real canvas, rendered from fixture data.
 *
 * Every section below is the same component the signed-in app renders — not a
 * lookalike. The landing page used to hand-build its own copy of this UI,
 * which meant every canvas change silently made the marketing page a lie.
 * Anything that needs to change visually here should change in the real
 * component, where it benefits both surfaces.
 *
 * The outer shell mirrors AppShell: full-bleed dotted canvas, a header bar
 * whose inner row is capped at 1024px, and a 1024px content column. Only the
 * column is capped — the background runs edge to edge, as it does in the app.
 *
 * Sections carry `data-tour-anchor` attributes for the scroll-driven product
 * tour to position tooltips against.
 */
export function CanvasPreview({
  showChrome = true,
  topBarStyle,
}: {
  showChrome?: boolean;
  /**
   * Lets the tour hold the top bar still while the canvas slides underneath
   * it. The bar stays part of the canvas — it just gets counter-translated by
   * however far the canvas has moved, which is what "sticky" means when the
   * scrolling is a transform rather than real scroll.
   */
  topBarStyle?: React.CSSProperties;
}) {
  const inertRef = useInert<HTMLDivElement>();
  const roadmapTodos = useRoadmapPreviewTodos();

  // Changes with the time of day, so the preview reads like a real canvas
  // opened right now. See previewGreeting for why it doesn't use the app's
  // own rotating phrase list.
  const greeting = useMemo(() => previewGreeting(), []);

  // Fixtures paint immediately and the real roadmap items swap in when the
  // query resolves — a skeleton in the hero would be worse than a value that
  // quietly sharpens a moment later.
  const items = useMemo<CanvasArtifactItem[]>(
    () =>
      [
        ...PREVIEW_CANVAS_ITEMS,
        ...roadmapTodos.map(
          (todo): CanvasArtifactItem => ({ kind: "todo", createdAt: todo.createdAt, data: todo }),
        ),
      ].sort((left, right) => left.createdAt - right.createdAt),
    [roadmapTodos],
  );

  return (
    <StaticUserSettingsProvider>
      <div
        ref={inertRef}
        aria-hidden="true"
        className="omanote-canvas-grid omanote-preview-type pointer-events-none select-none overflow-hidden bg-app-canvas text-left"
        // Renders the canvas in the app's "Font = Both" mode: serif for
        // headings and titles, sans for body. That's the pairing omanote ships
        // with, and it's the same variable `applyTypographySettings` flips —
        // scoped here so it only affects the preview, not the landing page
        // around it. See the h1–h6/.app-title-font rule in index.css.
        style={{ "--app-heading-font-family": "var(--app-font-family-serif)" } as React.CSSProperties}
      >
        {/* `relative z-20` so the canvas passes *under* the bar rather than
            painting over it once the tour holds it in place. */}
        <div className="relative z-20" style={topBarStyle}>
          <PreviewTopBar />
        </div>

        <div className={`${CONTENT_COLUMN} flex flex-col gap-10 py-6`}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <p
                data-tour-anchor="greeting"
                className="app-title-font flex flex-col text-left text-3xl font-bold text-app-ink sm:text-4xl md:flex-row md:gap-2"
              >
                <span>{greeting.emoji}</span>
                <span>{greeting.text}</span>
              </p>
              {/* `flex flex-col` so the glance card is a flex item and
                  stretches, as it does in CanvasScreen. Without it this anchor
                  wrapper leaves the <button> at fit-content width. */}
              <div data-tour-anchor="week-glance" className="flex flex-col">
                <CanvasWeekAtGlanceView glance={PREVIEW_WEEK_AT_GLANCE} onOpen={noop} />
              </div>
            </div>

            <div data-tour-anchor="updates">
              <CanvasSystemNoticeView>
                <UpdateNotificationRow
                  version={PREVIEW_UPDATE.version}
                  summary={PREVIEW_UPDATE.summary}
                  extraUpdatesCount={0}
                  onOpen={noop}
                />
                <SurveyPrompt status="not-started" onTakeSurvey={noop} onDismiss={noop} />
              </CanvasSystemNoticeView>
            </div>

            <div data-tour-anchor="continue-writing">
              <CanvasContinueWritingView
                pages={PREVIEW_PAGES}
                todayKey={PREVIEW_TODAY_KEY}
                dispatch={noop}
                onCreatePage={noop}
                staticPreview
              />
            </div>

            <div data-tour-anchor="overdue">
              <CanvasOverdueSection
                overdueTodos={PREVIEW_OVERDUE_TODOS}
                daysAway={0}
                recentAction={null}
                canvasDateKey={PREVIEW_TODAY_KEY}
                onOpenEditor={noop}
                onInlineTitleEdit={noop}
                onToggle={noop}
                onDelete={noop}
                onReschedule={noop}
              />
            </div>
          </div>

          <div data-tour-anchor="today" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {/* Its own anchor: the day feed is taller than the screen, so a
                  step about it has to point at the heading, not the section. */}
              <p
                data-tour-anchor="today-heading"
                className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-ink-faint"
              >
                Today
              </p>
              <div aria-hidden="true" className="h-px min-w-4 flex-1 bg-app-line" />
            </div>
            <CanvasDayArtifacts
              items={items}
              canvasDateKey={PREVIEW_TODAY_KEY}
              dispatch={noop}
              noteFolders={PREVIEW_NOTE_FOLDERS}
              categoryNameById={PREVIEW_CATEGORY_NAME_BY_ID}
              onOpenTodoEditor={noop}
              onInlineTodoTitleEdit={noop}
              onToggleTodo={noop}
              onDeleteTodo={noop}
              onEditBookmark={noop}
              staticPreview
            />
          </div>

          {/* Inline for the mobile fallback. The tour renders its own copy
              pinned to the bottom of the frame instead, so that the nav stays
              put while the canvas slides behind it, like the real app. */}
          {showChrome ? (
            <div data-tour-anchor="composer">
              <PreviewChrome />
            </div>
          ) : null}
        </div>
      </div>
    </StaticUserSettingsProvider>
  );
}
