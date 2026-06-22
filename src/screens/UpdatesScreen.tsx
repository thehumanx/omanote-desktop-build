import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { CHANGELOG_TABS, type ChangelogProduct } from "../components/ChangelogProductTabs";
import { SegmentedPill } from "../components/ui";
import { useTopChrome } from "../components/layout/useTopChrome";
import { parseLatestVersion } from "../lib/update-checker";

type RoadmapPhase = {
  phase: string;
  focus: string;
  outcomes: string[];
};

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

const ROADMAP: RoadmapPhase[] = [
  {
    phase: "Now",
    focus: "Core polish and reliability",
    outcomes: [
      "Make omanote more reliable and stable for day to day use",
      "Improve browser extensions reliability and performance",
    ],
  },
  {
    phase: "Next",
    focus: "Planned features",
    outcomes: [
      "Build mobile applications.",
      "Invite your friends to your omanote folders.",
      "Update landing page with better content, may be a tutorial for new users",
    ],
  },
  {
    phase: "Later",
    focus: "Connected omanote ecosystem",
    outcomes: [
      "May be utilize AI in omanote -- not a priority right now",
      "Voice notes for omanote -- maybe",
    ],
  },
];

const UPDATES_TAB_ITEMS = CHANGELOG_TABS.map((tab) => ({ key: tab.id, label: tab.label }));

function extractVersionsSection(markdown: string, sectionTitle = "Versions"): string {
  const lines = markdown.split(/\r?\n/);
  const normalizedSectionTitle = `## ${sectionTitle}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === normalizedSectionTitle);
  if (start === -1) return "";

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n").trim();
}

function parseSimpleMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

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

export function UpdatesScreen() {
  const [activeTab, setActiveTab] = useState<ChangelogProduct>("webapp");
  const activeTabConfig = CHANGELOG_TABS.find((tab) => tab.id === activeTab) ?? CHANGELOG_TABS[0];
  const versionLabel = useMemo(() => parseLatestVersion(changelogMarkdown)?.version ?? "", []);

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

  const versionsMarkdown = useMemo(() => extractVersionsSection(changelogMarkdown, activeTabConfig.sectionTitle), [activeTabConfig.sectionTitle]);
  const versionBlocks = useMemo(() => parseSimpleMarkdown(versionsMarkdown), [versionsMarkdown]);
  const versionGroups = useMemo(() => groupVersionBlocks(versionBlocks), [versionBlocks]);

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-app-line bg-app-surface p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-ink-faint">omanote updates</p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.02em] text-app-ink">What shipped and what is coming next.</h2>
        <p className="mt-3 max-w-[760px] text-sm leading-relaxed text-app-ink-muted">
          Versions are rendered directly from markdown so changelog history stays transparent and easy to keep up to date.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-app-line bg-app-surface p-5 sm:p-6">
        <div className="flex w-full justify-start">
          <SegmentedPill
            activeKey={activeTab}
            ariaLabel="Changelog product"
            items={UPDATES_TAB_ITEMS}
            onChange={(key) => setActiveTab(key as ChangelogProduct)}
          />
        </div>
        {versionGroups.length ? (
          <div className="mt-4 space-y-3">
            {versionGroups.map((group, groupIndex) => {
              const isLatest = groupIndex === 0;
              const changelogContent = (
                <div className="space-y-3">
                  {group.summary && (
                    <p className="rounded-lg bg-app-surface-muted px-4 py-2.5 text-sm leading-relaxed text-app-ink-muted">
                      {renderInline(group.summary)}
                    </p>
                  )}
                  {group.blocks.map((block, i) => {
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
                </div>
              );

              if (isLatest) {
                return (
                  <div key={group.heading} className="space-y-3">
                    <h3 className="text-base font-bold text-app-ink">{renderInline(group.heading)}</h3>
                    {changelogContent}
                  </div>
                );
              }

              return (
                <details key={group.heading} className="group border-b border-app-line last:border-b-0">
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
                    {group.blocks.map((block, i) => {
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

      <section className="mt-6 rounded-2xl border border-app-line bg-app-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold text-app-ink">Roadmap view</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {ROADMAP.map((entry) => (
            <article key={entry.phase} className="rounded-xl border border-app-line bg-app-surface-muted px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-ink-faint">{entry.phase}</p>
              <h3 className="mt-1.5 text-sm font-bold text-app-ink">{entry.focus}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-app-ink-muted">
                {entry.outcomes.map((outcome) => (
                  <li key={outcome} className="list-disc ml-4">
                    {outcome}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-8 pb-2 text-center text-xs font-medium text-app-ink-faint">
        omanote {versionLabel}
      </footer>
    </div>
  );
}
