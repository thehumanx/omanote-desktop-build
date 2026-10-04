import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { CHANGELOG_TABS, type ChangelogProduct } from "../content/changelog-tabs";
import { Badge, SegmentedPill } from "../components/ui";
import { useTopChrome } from "../components/layout/useTopChrome";
import { currentVersion } from "virtual:changelog";
import { extractSection, MILESTONE_RE, parseMilestones, type Milestone } from "../lib/changelog-parse";

type MarkdownBlock =
  | { type: "h3"; text: string }
  | { type: "h4"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

type VersionGroup = {
  heading: string;
  summary: string | null;
  blocks: MarkdownBlock[];
};

type UpdatesTab = "timeline" | ChangelogProduct;

const UPDATES_TAB_ITEMS = [{ key: "timeline", label: "Timeline" }, ...CHANGELOG_TABS.map((tab) => ({ key: tab.id, label: tab.label }))];

const PRODUCT_LABEL: Record<ChangelogProduct, string> = { application: "App", extension: "Extension" };

function versionAnchorId(product: ChangelogProduct, heading: string): string {
  const version = heading.match(/^v[\d.]+/)?.[0] ?? heading;
  return `updates-${product}-${version}`;
}

function parseSimpleMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || MILESTONE_RE.test(line)) continue;

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("#### ")) {
      blocks.push({ type: "h4", text: line.slice(5).trim() });
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: line.slice(2).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      for (let j = i; j < lines.length; j += 1) {
        const item = lines[j].trim();
        if (!item.startsWith("- ")) {
          i = j - 1;
          break;
        }
        items.push(item.slice(2).trim());
        if (j === lines.length - 1) {
          i = j;
        }
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const paragraphLines = [line];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next || next.startsWith("### ") || next.startsWith("#### ") || next.startsWith("- ")) {
        i = j - 1;
        break;
      }
      paragraphLines.push(next);
      if (j === lines.length - 1) {
        i = j;
      }
    }
    blocks.push({ type: "p", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function groupVersionBlocks(blocks: MarkdownBlock[]): VersionGroup[] {
  const groups: VersionGroup[] = [];
  let current: VersionGroup | null = null;

  for (const block of blocks) {
    if (block.type === "h3") {
      if (current) groups.push(current);
      current = { heading: block.text, summary: null, blocks: [] };
    } else if (current) {
      if (block.type === "blockquote" && current.summary === null) {
        current.summary = block.text;
      } else {
        current.blocks.push(block);
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (segment.startsWith("`") && segment.endsWith("`")) {
        return (
          <code key={`code-${index}`} className="rounded bg-app-surface-muted px-1.5 py-0.5 text-xs text-app-ink-muted">
            {segment.slice(1, -1)}
          </code>
        );
      }
      return <span key={`text-${index}`}>{segment}</span>;
    });
}

function VersionBlocks({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-4 text-sm text-app-ink-muted">
              {block.items.map((item) => (
                <li key={item} className="list-disc">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "p") {
          return (
            <p key={i} className="text-sm leading-relaxed text-app-ink-muted">
              {renderInline(block.text)}
            </p>
          );
        }
        return null;
      })}
    </>
  );
}

function groupMilestonesByMonth(milestones: Milestone[]): Array<{ month: string; items: Milestone[] }> {
  const groups: Array<{ month: string; items: Milestone[] }> = [];
  for (const milestone of milestones) {
    const month = Number.isNaN(milestone.time)
      ? milestone.date
      : new Date(milestone.time).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(milestone);
    else groups.push({ month, items: [milestone] });
  }
  return groups;
}

function shortDate(milestone: Milestone): string {
  return Number.isNaN(milestone.time)
    ? milestone.date
    : new Date(milestone.time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MilestoneTimeline({ onOpen }: { onOpen: (milestone: Milestone) => void }) {
  const months = useMemo(() => groupMilestonesByMonth(parseMilestones(changelogMarkdown)), []);

  if (!months.length) {
    return <p className="mt-4 text-sm text-app-ink-muted">No milestones yet.</p>;
  }

  return (
    <ol className="mt-5 space-y-6">
      {months.map(({ month, items }) => (
        <li key={month}>
          <h3 className="text-xs font-bold uppercase text-app-ink-faint">{month}</h3>
          <ol className="mt-2">
            {items.map((milestone, index) => (
              <li key={`${milestone.product}-${milestone.version}`} className="flex gap-3">
                <div aria-hidden="true" className="flex w-3 shrink-0 flex-col items-center pt-4">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-app-ink" />
                  {index < items.length - 1 && <span className="mt-1 w-px flex-1 bg-app-line" />}
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(milestone)}
                  className="min-w-0 flex-1 rounded-app-field px-3 py-2.5 text-left transition-colors hover:bg-app-surface-muted"
                >
                  <span className="flex flex-wrap items-center gap-2 text-xs text-app-ink-faint">
                    <span>{shortDate(milestone)}</span>
                    <Badge variant={milestone.product === "application" ? "muted" : "outline"}>{PRODUCT_LABEL[milestone.product]}</Badge>
                    <span>{milestone.version}</span>
                  </span>
                  <span className="mt-1 block text-sm font-bold text-app-ink">{milestone.title}</span>
                  {milestone.summary && (
                    <span className="mt-0.5 block text-sm leading-relaxed text-app-ink-muted">{renderInline(milestone.summary)}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

export function UpdatesScreen() {
  const [activeTab, setActiveTab] = useState<UpdatesTab>("timeline");
  // Version opened from the timeline: expanded and scrolled to in its product tab.
  const [focusedAnchor, setFocusedAnchor] = useState<string | null>(null);
  const productTab = activeTab === "timeline" ? null : activeTab;
  const activeTabConfig = CHANGELOG_TABS.find((tab) => tab.id === productTab) ?? CHANGELOG_TABS[0];
  const versionLabel = currentVersion?.version ?? "";

  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center justify-between gap-3">
        <h1 className="truncate text-lg font-bold text-app-ink">Changelog & Roadmap</h1>
        {versionLabel && (
          <span className="inline-flex rounded-full border border-app-line bg-app-surface px-2.5 py-1 text-xs font-bold text-app-ink-muted">
            {versionLabel}
          </span>
        )}
      </div>
    ),
    [versionLabel],
  );
  useTopChrome(topChrome);

  const versionGroups = useMemo(
    () => groupVersionBlocks(parseSimpleMarkdown(extractSection(changelogMarkdown, activeTabConfig.sectionTitle))),
    [activeTabConfig.sectionTitle],
  );

  useEffect(() => {
    if (!focusedAnchor) return;
    document.getElementById(focusedAnchor)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusedAnchor, activeTab]);

  const openMilestone = (milestone: Milestone) => {
    setActiveTab(milestone.product);
    setFocusedAnchor(versionAnchorId(milestone.product, milestone.version));
  };

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-app-line bg-app-surface p-5 sm:p-6">
        <p className="text-xs font-bold uppercase text-app-ink-faint">omanote updates</p>
        <h2 className="mt-3 text-2xl font-black text-app-ink">What shipped and what is coming next.</h2>
        <p className="mt-3 max-w-[760px] text-sm leading-relaxed text-app-ink-muted">
          The big moments are on the timeline. Every release, big or small, is under Application and Extension.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-app-line bg-app-surface p-5 sm:p-6">
        <div className="flex w-full justify-start">
          <SegmentedPill
            activeKey={activeTab}
            ariaLabel="Changelog view"
            items={UPDATES_TAB_ITEMS}
            onChange={(key) => {
              setActiveTab(key as UpdatesTab);
              setFocusedAnchor(null);
            }}
          />
        </div>
        {productTab === null ? (
          <MilestoneTimeline onOpen={openMilestone} />
        ) : versionGroups.length ? (
          <div className="mt-4 space-y-3">
            {versionGroups.map((group, groupIndex) => {
              const anchorId = versionAnchorId(productTab, group.heading);

              if (groupIndex === 0) {
                return (
                  <div key={group.heading} id={anchorId} className="scroll-mt-24 space-y-3">
                    <h3 className="text-base font-bold text-app-ink">{renderInline(group.heading)}</h3>
                    <div className="space-y-3">
                      {group.summary && (
                        <p className="rounded-lg bg-app-surface-muted px-4 py-2.5 text-sm leading-relaxed text-app-ink-muted">
                          {renderInline(group.summary)}
                        </p>
                      )}
                      <VersionBlocks blocks={group.blocks} />
                    </div>
                  </div>
                );
              }

              return (
                <details
                  key={group.heading}
                  id={anchorId}
                  open={anchorId === focusedAnchor || undefined}
                  className="group scroll-mt-24 border-b border-app-line last:border-b-0"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-app-ink">{renderInline(group.heading)}</h3>
                      {group.summary && (
                        <p className="mt-1 text-xs leading-relaxed text-app-ink-faint">{renderInline(group.summary)}</p>
                      )}
                    </div>
                    <span className="mt-0.5 shrink-0 text-app-ink-faint transition-transform group-open:rotate-90">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </summary>
                  <div className="border-t border-app-line pb-4 pt-3 space-y-3">
                    <VersionBlocks blocks={group.blocks} />
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-app-ink-muted">
            Add a <code className="rounded bg-app-surface-muted px-1.5 py-0.5 text-xs text-app-ink-muted">## Versions</code> section in <code className="rounded bg-app-surface-muted px-1.5 py-0.5 text-xs text-app-ink-muted">CHANGELOG.md</code> to populate this area.
          </p>
        )}
      </section>

      <footer className="mt-8 pb-2 text-center text-xs font-medium text-app-ink-faint">
        omanote {versionLabel}
      </footer>
    </div>
  );
}
