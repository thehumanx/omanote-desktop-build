import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { cn } from "../components/ui";
import {
  deriveInsights,
  deriveVerdict,
  pct,
  totalActiveUsers,
  type Insight,
  type InsightSeverity,
  type PmfDashboard,
} from "./admin/pmf-insights";

const DAY_MS = 86_400_000;

type DirectoryEntry = {
  subject: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: number | null;
  lastSignInAt: number | null;
};

/** Clerk subject (`user_abc`) out of a Convex tokenIdentifier. */
function clerkSubject(userId: string): string {
  return userId.split("|").pop() ?? userId;
}

/**
 * Names and emails come from Clerk, not Convex — see `getUserDirectory`. It's a
 * one-shot network call, so it loads separately from the reactive dashboard
 * query and the table falls back to truncated ids if it fails.
 */
function useUserDirectory(): { directory: Map<string, DirectoryEntry> | null; error: string | null } {
  const getUserDirectory = useAction(api.adminMetrics.getUserDirectory);
  const [directory, setDirectory] = useState<Map<string, DirectoryEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserDirectory({})
      .then((entries) => {
        if (cancelled) return;
        setDirectory(new Map(entries.map((entry) => [entry.subject, entry])));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load user identities.");
      });
    return () => {
      cancelled = true;
    };
  }, [getUserDirectory]);

  return { directory, error };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatDate(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

function daysAgo(ts: number | null, now: number): string {
  if (ts === null) return "—";
  const days = Math.floor((now - ts) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function shortUserId(userId: string): string {
  const subject = userId.split("|").pop() ?? userId;
  return subject.length > 12 ? `…${subject.slice(-10)}` : subject;
}

function humanizeChoice(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-sm font-bold text-app-ink">{title}</h2>
      {hint && <p className="mt-1 text-xs leading-relaxed text-app-ink-faint">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-app-card border border-app-line bg-app-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-faint">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
          tone === "neutral" && "text-app-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-app-ink-faint">{sub}</p>}
    </div>
  );
}

function Bar({ value, max, tone = "neutral" }: { value: number; max: number; tone?: "neutral" | "good" | "bad" }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-line">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "good" && "bg-emerald-500",
          tone === "bad" && "bg-red-500",
          tone === "neutral" && "bg-app-ink/60",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

const SEVERITY_STYLE: Record<InsightSeverity, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: XCircle, className: "text-red-600 border-red-200 bg-red-50", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-amber-700 border-amber-200 bg-amber-50", label: "Warning" },
  info: { icon: Info, className: "text-sky-700 border-sky-200 bg-sky-50", label: "Note" },
  ok: { icon: CheckCircle2, className: "text-emerald-700 border-emerald-200 bg-emerald-50", label: "Healthy" },
};

function InsightCard({ insight }: { insight: Insight }) {
  const style = SEVERITY_STYLE[insight.severity];
  const Icon = style.icon;
  return (
    <div className={cn("rounded-app-card border p-4", style.className)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{insight.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">{insight.detail}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-app-ink">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{insight.suggestion}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "border-b border-app-line px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-app-ink-faint",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td
      {...props}
      className={cn(
        "border-b border-app-line/60 px-2 py-1.5 text-xs text-app-ink",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function CohortGrid({ data }: { data: PmfDashboard }) {
  if (data.cohorts.length === 0) {
    return <p className="text-xs text-app-ink-faint">No cohorts yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <Th>Signup month</Th>
            <Th align="right">Users</Th>
            {Array.from({ length: data.cohortWeeks }, (_, i) => (
              <Th key={i} align="right">
                W{i}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cohorts.map((cohort) => (
            <tr key={cohort.month}>
              <Td>{cohort.month}</Td>
              <Td align="right">{cohort.size}</Td>
              {cohort.weeks.map((week, i) => {
                if (week === null) {
                  return (
                    <Td key={i} align="right" className="text-app-ink-faint/50">
                      –
                    </Td>
                  );
                }
                const share = pct(week.retained, week.eligible);
                return (
                  <Td key={i} align="right">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 font-medium",
                        share === 0 && "text-app-ink-faint/60",
                        share > 0 && share < 25 && "bg-red-50 text-red-700",
                        share >= 25 && share < 50 && "bg-amber-50 text-amber-700",
                        share >= 50 && "bg-emerald-50 text-emerald-700",
                      )}
                      title={`${week.retained}/${week.eligible} retained`}
                    >
                      {share}%
                    </span>
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyTable({ data }: { data: PmfDashboard }) {
  const maxActive = Math.max(1, ...data.monthly.map((m) => m.active));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <Th>Month</Th>
            <Th align="right">Signups</Th>
            <Th align="right">Active</Th>
            <Th align="right">New</Th>
            <Th align="right">Returning</Th>
            <Th align="right">Events</Th>
            <Th>Active users</Th>
          </tr>
        </thead>
        <tbody>
          {data.monthly.map((m) => (
            <tr key={m.month}>
              <Td>{m.month}</Td>
              <Td align="right">{m.signups}</Td>
              <Td align="right" className="font-bold">
                {m.active}
              </Td>
              <Td align="right">{m.newActive}</Td>
              <Td align="right" className={m.returning === 0 ? "text-red-600" : undefined}>
                {m.returning}
              </Td>
              <Td align="right">{m.events.toLocaleString()}</Td>
              <Td>
                <Bar value={m.active} max={maxActive} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTable({
  data,
  directory,
}: {
  data: PmfDashboard;
  directory: Map<string, DirectoryEntry> | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>First seen</Th>
            <Th>Last wrote</Th>
            <Th>Last sign-in</Th>
            <Th align="right">Active days</Th>
            <Th align="right">Events</Th>
            <Th align="right">Modules</Th>
            <Th>Todos</Th>
            <Th>Clients</Th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => {
            const identity = directory?.get(clerkSubject(u.userId)) ?? null;
            return (
            <tr key={u.userId} className={u.isAdmin ? "bg-app-surface-muted/60" : undefined}>
              <Td>
                <span className="block max-w-[220px] truncate" title={u.userId}>
                  {identity?.name ?? identity?.email ?? (
                    <span className="font-mono text-[11px]">{shortUserId(u.userId)}</span>
                  )}
                  {u.isAdmin && <span className="ml-1.5 text-[10px] font-bold text-app-ink-faint">YOU</span>}
                  {u.hasSurvey && <span className="ml-1.5 text-[10px] text-sky-600">survey</span>}
                </span>
                {identity?.email && identity.name && (
                  <a
                    href={`mailto:${identity.email}`}
                    className="block max-w-[220px] truncate text-[11px] text-app-ink-faint hover:text-app-ink hover:underline"
                  >
                    {identity.email}
                  </a>
                )}
              </Td>
              <Td>{formatDate(u.firstActiveAt)}</Td>
              <Td
                className={
                  u.lastActiveAt !== null && data.generatedAt - u.lastActiveAt > 30 * DAY_MS
                    ? "text-red-600"
                    : undefined
                }
              >
                {daysAgo(u.lastActiveAt, data.generatedAt)}
              </Td>
              <Td
                className={
                  identity?.lastSignInAt != null &&
                  u.lastActiveAt !== null &&
                  identity.lastSignInAt - u.lastActiveAt > 7 * DAY_MS
                    ? "text-sky-600"
                    : undefined
                }
                title={
                  identity?.lastSignInAt != null
                    ? "Blue means they signed in well after their last write — reading, not churned"
                    : undefined
                }
              >
                {identity ? daysAgo(identity.lastSignInAt, data.generatedAt) : "—"}
              </Td>
              <Td align="right" className={u.daysActive <= 1 ? "text-red-600" : "font-bold"}>
                {u.daysActive}
              </Td>
              <Td align="right">{u.events.toLocaleString()}</Td>
              <Td align="right">{u.modulesUsed}/5</Td>
              <Td>
                <span className="tabular-nums text-[11px] text-app-ink-muted">
                  {u.created.todo} made
                </span>
              </Td>
              <Td>
                <span className="text-[11px] text-app-ink-faint">{u.devices.join(", ") || "—"}</span>
              </Td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SurveySection({ data }: { data: PmfDashboard }) {
  if (data.survey.started === 0) {
    return <p className="text-xs text-app-ink-faint">No survey responses yet.</p>;
  }
  return (
    <div className="space-y-4">
      {data.survey.questions.map((q) => {
        const totalChoices = q.choices.reduce((sum, c) => sum + c.count, 0);
        const avgRating =
          q.ratings.length > 0 ? (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length).toFixed(1) : null;
        return (
          <div key={q.questionId} className="rounded-app-card border border-app-line bg-app-surface p-3">
            <p className="text-xs font-bold text-app-ink">{humanizeChoice(q.questionId)}</p>
            {avgRating && (
              <p className="mt-1 text-xs text-app-ink-muted">
                Average <span className="font-bold tabular-nums">{avgRating}</span> from {q.ratings.length}{" "}
                {q.ratings.length === 1 ? "rating" : "ratings"} ({q.ratings.join(", ")})
              </p>
            )}
            {q.choices.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {q.choices.map((c) => (
                  <li key={c.value} className="flex items-center gap-2">
                    <span className="w-44 shrink-0 truncate text-[11px] text-app-ink-muted">
                      {humanizeChoice(c.value)}
                    </span>
                    <Bar value={c.count} max={totalChoices} />
                    <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-app-ink-faint">
                      {c.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {q.texts.length > 0 && (
              <ul className="mt-2 space-y-1.5 border-t border-app-line pt-2">
                {q.texts.map((text, i) => (
                  <li key={i} className="text-xs italic leading-relaxed text-app-ink-muted">
                    “{text}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModuleConversionTable({ data }: { data: PmfDashboard }) {
  if (data.moduleConversion.length === 0) {
    return <p className="text-xs text-app-ink-faint">Not enough data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse">
        <thead>
          <tr>
            <Th>Started with</Th>
            <Th>Also touched</Th>
            <Th align="right">Eligible</Th>
            <Th align="right">Converted</Th>
          </tr>
        </thead>
        <tbody>
          {data.moduleConversion.map((row) => {
            const share = pct(row.converted, row.eligible);
            return (
              <tr key={`${row.from}-${row.to}`}>
                <Td className="capitalize">{row.from}</Td>
                <Td className="capitalize">{row.to}</Td>
                <Td align="right">{row.eligible}</Td>
                <Td align="right" className={share < 20 ? "text-red-600" : undefined}>
                  {row.converted} ({share}%)
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PmfSegmentsTable({ data }: { data: PmfDashboard }) {
  const totalRespondents = data.pmfSegments.reduce((sum, s) => sum + s.users, 0);
  if (totalRespondents === 0) {
    return <p className="text-xs text-app-ink-faint">No PMF survey answers yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <Th>If omanote disappeared…</Th>
            <Th align="right">Respondents</Th>
            <Th align="right">Avg days active</Th>
            <Th align="right">Todo close rate</Th>
            <Th align="right">Retained past D30</Th>
          </tr>
        </thead>
        <tbody>
          {data.pmfSegments.map((s) => (
            <tr key={s.bucket}>
              <Td>{s.label}</Td>
              <Td align="right">{s.users}</Td>
              <Td align="right">{s.avgDaysActive}</Td>
              <Td align="right">{s.todoCloseRate}%</Td>
              <Td align="right">{s.retainedPast30}%</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeclaredGoalsTable({ data }: { data: PmfDashboard }) {
  if (data.declaredGoalsBreakdown.length === 0) {
    return <p className="text-xs text-app-ink-faint">No declared onboarding goals yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr>
            <Th>Declared goal</Th>
            <Th align="right">Users</Th>
            <Th align="right">Activation rate</Th>
            <Th align="right">Retention past D30</Th>
          </tr>
        </thead>
        <tbody>
          {data.declaredGoalsBreakdown.map((g) => (
            <tr key={g.goal}>
              <Td>{humanizeChoice(g.goal)}</Td>
              <Td align="right">{g.declared}</Td>
              <Td align="right" className={g.activationRate < 50 ? "text-red-600" : undefined}>
                {g.activationRate}%
              </Td>
              <Td align="right">{g.retentionRate}%</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FEEDBACK_STATUSES = ["new", "planned", "done", "declined"] as const;

function FeedbackList({ data }: { data: PmfDashboard }) {
  const updateStatus = useMutation(api.feedback.updateStatus);

  if (data.feedback.length === 0) {
    return <p className="text-xs text-app-ink-faint">No feedback submitted yet.</p>;
  }

  const themeCounts = new Map<string, number>();
  for (const f of data.feedback) {
    if (f.theme) themeCounts.set(f.theme, (themeCounts.get(f.theme) ?? 0) + 1);
  }
  const openCount = data.feedback.filter((f) => f.status === "new").length;

  return (
    <div>
      <p className="mb-2 text-[11px] text-app-ink-faint">
        {openCount} untriaged
        {themeCounts.size > 0 &&
          ` · ${[...themeCounts.entries()].map(([theme, count]) => `${theme} (${count})`).join(", ")}`}
      </p>
      <ul className="space-y-2">
        {data.feedback.map((f) => (
          <li key={f.id} className="rounded-app-card border border-app-line bg-app-surface p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-app-ink-faint">
              <span className="rounded bg-app-surface-muted px-1.5 py-0.5 font-medium">{f.type}</span>
              <span>{formatDate(f.createdAt)}</span>
              {f.appVersion && <span>· {f.appVersion}</span>}
              <select
                value={f.status}
                onChange={(e) => void updateStatus({ feedbackId: f.id, status: e.target.value as (typeof FEEDBACK_STATUSES)[number] })}
                className="ml-auto rounded border border-app-line bg-app-surface px-1.5 py-0.5 text-[11px] text-app-ink"
              >
                {FEEDBACK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="text"
                defaultValue={f.theme ?? ""}
                placeholder="theme…"
                onBlur={(e) => {
                  const theme = e.target.value.trim();
                  if (theme !== (f.theme ?? "")) void updateStatus({ feedbackId: f.id, theme });
                }}
                className="w-24 rounded border border-app-line bg-app-surface px-1.5 py-0.5 text-[11px] text-app-ink"
              />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-app-ink">{f.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const data = useQuery(api.adminMetrics.getDashboard, {});
  const { directory, error: directoryError } = useUserDirectory();

  const insights = useMemo(() => (data ? deriveInsights(data) : []), [data]);
  const verdict = useMemo(() => (data ? deriveVerdict(data, insights) : null), [data, insights]);

  if (data === undefined) {
    return <p className="p-6 text-sm text-app-ink-faint">Loading product metrics…</p>;
  }

  const active = totalActiveUsers(data);
  const dist = data.daysActiveDistribution;
  const maxModuleUsers = Math.max(1, ...data.moduleAdoption.map((m) => m.users));
  const maxFeatureUsers = Math.max(1, ...data.featureAdoption.map((f) => f.users));
  const verdictStyle = verdict ? SEVERITY_STYLE[verdict.tone] : null;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-lg font-bold text-app-ink">Product health</h1>
        <p className="mt-1 text-xs text-app-ink-faint">
          Every figure below excludes your own account unless labelled otherwise. Generated{" "}
          {new Date(data.generatedAt).toLocaleString()}.
        </p>
      </header>

      {verdict && verdictStyle && (
        <div className={cn("mt-5 rounded-app-card border p-4", verdictStyle.className)}>
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">Verdict</p>
          <p className="mt-0.5 text-base font-bold">{verdict.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">{verdict.summary}</p>
        </div>
      )}

      <Section title="Headline" hint="Onboarded means the user completed end-to-end encryption setup.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Onboarded" value={data.funnel.onboarded} />
          <StatCard label="Ever created" value={data.funnel.everCreated} sub={`${pct(data.funnel.everCreated, data.funnel.onboarded)}% of onboarded`} />
          <StatCard
            label="Returned day 2"
            value={data.funnel.returnedDay2}
            sub={`${pct(data.funnel.returnedDay2, data.funnel.onboarded)}% of onboarded`}
            tone={pct(data.funnel.returnedDay2, data.funnel.onboarded) < 40 ? "bad" : "good"}
          />
          <StatCard label="Active 7d" value={data.funnel.activeLast7} sub={`WAU/MAU ${pct(data.funnel.activeLast7, Math.max(1, data.funnel.activeLast30))}%`} />
          <StatCard label="Active 30d" value={data.funnel.activeLast30} />
          <StatCard
            label="Dormant 30d+"
            value={data.funnel.dormant30Plus}
            tone={data.funnel.dormant30Plus > active / 2 ? "bad" : "neutral"}
          />
        </div>
      </Section>

      <Section
        title="Session activity (reads + writes)"
        hint="Everything else on this page is derived from activityHistory, which only records writes. This section comes from appSessions instead, so it also counts users who opened the app and read without editing."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="True active 7d" value={data.sessionActivity.trueActiveLast7} sub="opened the app at all" />
          <StatCard label="Write-active 7d" value={data.sessionActivity.writeActiveLast7} sub="created/edited something" />
          <StatCard
            label="Read-only 7d"
            value={data.sessionActivity.readOnlyLast7}
            sub="opened, wrote nothing"
            tone={data.sessionActivity.readOnlyLast7 > data.sessionActivity.trueActiveLast7 / 3 ? "bad" : "neutral"}
          />
        </div>
      </Section>

      <Section
        title="Insights & suggestions"
        hint="Threshold-based rules over the data above — they re-evaluate every time this page loads."
      >
        <div className="space-y-2.5">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </Section>

      <Section
        title="Retention"
        hint="Measured from each user's first recorded activity. Eligible excludes users too new to have had the chance."
      >
        <div className="space-y-2">
          {data.retentionBuckets.map((bucket) => {
            const share = pct(bucket.retained, bucket.eligible);
            return (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-app-ink-muted">{bucket.label}</span>
                <Bar value={bucket.retained} max={Math.max(1, bucket.eligible)} tone={share < 25 ? "bad" : "good"} />
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-app-ink-faint">
                  {bucket.retained}/{bucket.eligible} ({share}%)
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="1 day only" value={dist.oneDay} tone="bad" sub={`${pct(dist.oneDay, active)}% of active`} />
          <StatCard label="2–3 days" value={dist.twoToThree} />
          <StatCard label="4–9 days" value={dist.fourToNine} />
          <StatCard label="10+ days" value={dist.tenPlus} tone="good" />
        </div>
      </Section>

      <Section
        title="Cohort retention"
        hint="Rows are signup months; W0 is the signup week itself. A healthy product shows the row flattening rather than reaching 0%."
      >
        <CohortGrid data={data} />
      </Section>

      <Section
        title="Monthly trend"
        hint="If Active stays flat while Signups accumulate, new users are replacing churned ones rather than adding to them."
      >
        <MonthlyTable data={data} />
      </Section>

      <Section title="Module & feature adoption" hint="Distinct non-founder users who have ever used each.">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-app-ink-faint">Modules</p>
            <div className="space-y-2">
              {data.moduleAdoption.map((m) => (
                <div key={m.module} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs capitalize text-app-ink-muted">{m.module}</span>
                  <Bar value={m.users} max={maxModuleUsers} />
                  <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-app-ink-faint">
                    {m.users} users · {m.created}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-app-ink-faint">Features</p>
            <div className="space-y-2">
              {data.featureAdoption.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-xs text-app-ink-muted" title={f.label}>
                    {f.label}
                  </span>
                  <Bar value={f.users} max={maxFeatureUsers} tone={f.users <= 2 ? "bad" : "neutral"} />
                  <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-app-ink-faint">
                    {f.users}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Todo close rate"
            value={`${pct(data.todoFunnel.othersCompleted, data.todoFunnel.othersCreated)}%`}
            sub={`${data.todoFunnel.othersCompleted}/${data.todoFunnel.othersCreated} — users`}
          />
          <StatCard
            label="Your close rate"
            value={`${pct(data.todoFunnel.adminCompleted, data.todoFunnel.adminCreated)}%`}
            sub={`${data.todoFunnel.adminCompleted}/${data.todoFunnel.adminCreated} — you`}
          />
          <StatCard
            label="Your share of activity"
            value={`${pct(data.founderShare.adminEvents, data.founderShare.totalEvents)}%`}
            sub={`${data.founderShare.adminEvents.toLocaleString()} of ${data.founderShare.totalEvents.toLocaleString()} events`}
            tone={pct(data.founderShare.adminEvents, data.founderShare.totalEvents) > 50 ? "bad" : "neutral"}
          />
          <StatCard label="Paying users" value={data.funnel.paying} tone={data.funnel.paying === 0 ? "bad" : "good"} />
        </div>

        <p className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wide text-app-ink-faint">
          Module conversion — touched module A in first 7 days, also touched module B within 14 days of that
        </p>
        <ModuleConversionTable data={data} />
      </Section>

      <Section
        title="PMF answer vs. actual behavior"
        hint="Cross-tabs the Sean Ellis survey question against real retention and todo close rate — the point isn't the survey score alone, it's whether the score predicts anything."
      >
        <PmfSegmentsTable data={data} />
      </Section>

      <Section
        title="Declared goals vs. actual usage"
        hint="What people said they came for (Welcome step, optional) versus whether they ever created anything at all."
      >
        <DeclaredGoalsTable data={data} />
      </Section>

      <Section title={`Survey — ${data.survey.completed} of ${data.survey.started} completed`}>
        <SurveySection data={data} />
      </Section>

      <Section title={`Feedback (${data.feedback.length})`}>
        <FeedbackList data={data} />
      </Section>

      <Section
        title="All users"
        hint="Sorted by most recent activity. Red is dormant or one-day-only; a blue sign-in means they're still opening the app without writing anything."
      >
        {directoryError && (
          <p className="mb-2 text-xs text-amber-700">
            Showing user ids — could not load names from Clerk: {directoryError}
          </p>
        )}
        {!directoryError && directory === null && (
          <p className="mb-2 text-xs text-app-ink-faint">Loading names from Clerk…</p>
        )}
        <UsersTable data={data} directory={directory} />
      </Section>

      <p className="mt-10 text-[11px] leading-relaxed text-app-ink-faint">
        Caveat: every metric above is derived from activityHistory, which only records writes — a user who
        reads without editing counts as dormant. The last sign-in column is the one exception, and it comes
        from Clerk. Where the two disagree, treat the sign-in as the truth about churn.
      </p>
    </div>
  );
}
