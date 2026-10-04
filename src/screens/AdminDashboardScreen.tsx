import { useEffect, useMemo, useState } from "react";
import { useAction, useConvex, useMutation } from "convex/react";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, RefreshCw, XCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { BaseModal } from "../components/BaseModal";
import { Button, cn } from "../components/ui";
import {
  activationFunnel,
  deriveInsights,
  deriveVerdict,
  ofTotal,
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
      <p className="text-[11px] font-medium uppercase text-app-ink-faint">{label}</p>
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
        "border-b border-app-line px-2 py-1.5 text-[11px] font-medium uppercase text-app-ink-faint",
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
  onRequestDelete,
}: {
  data: PmfDashboard;
  directory: Map<string, DirectoryEntry> | null;
  onRequestDelete: (user: PmfDashboard["users"][number]) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] border-collapse">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Last 28 days</Th>
            <Th>First seen</Th>
            <Th>Last active</Th>
            <Th>Last sign-in</Th>
            <Th align="right">Active days</Th>
            <Th align="right">Events</Th>
            <Th align="right">Modules</Th>
            <Th>Todos</Th>
            <Th>Clients</Th>
            <Th>Source</Th>
            <Th>{null}</Th>
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
              <Td>
                <ActivityStrip days={u.last28} />
                {u.activated !== null && (
                  <span className={cn("ml-1.5 text-[10px]", u.activated ? "text-emerald-600" : "text-app-ink-faint")}>
                    {u.activated ? "activated" : "not activated"}
                  </span>
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
              <Td>
                <span className="text-[11px] text-app-ink-faint">{u.source ?? "—"}</span>
              </Td>
              <Td align="right">
                {!u.isAdmin && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-danger-ink hover:underline"
                    onClick={() => onRequestDelete(u)}
                  >
                    Delete…
                  </button>
                )}
              </Td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeleteUserModal({
  user,
  identity,
  onClose,
}: {
  user: PmfDashboard["users"][number];
  identity: DirectoryEntry | null;
  onClose: () => void;
}) {
  const adminDeleteUser = useAction(api.account.adminDeleteUser);
  const [confirmation, setConfirmation] = useState("");
  const [alsoDeleteLogin, setAlsoDeleteLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmation.trim() === "DELETE";
  const label = identity?.name ?? identity?.email ?? shortUserId(user.userId);

  async function handleDelete() {
    if (!canDelete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminDeleteUser({ targetUserId: user.userId, alsoDeleteLogin });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this user.");
      setSubmitting(false);
    }
  }

  return (
    <BaseModal label={`Delete ${label}`} role="alertdialog" onClose={() => { if (!submitting) onClose(); }}>
      <div
        className="w-full max-w-md rounded-app-card border border-app-line bg-app-surface p-5 shadow-app-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold text-app-ink">Delete {label}</p>
        <p className="mt-1 text-xs leading-relaxed text-app-ink-faint">
          Wipes all of this account's omanote data — notes, todos, bookmarks, events, encryption keys, everything.
          This cannot be undone.
        </p>

        <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-app-ink-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={alsoDeleteLogin}
            onChange={(e) => setAlsoDeleteLogin(e.target.checked)}
          />
          <span>
            Also delete their login. Leave this unchecked for a "forgot passphrase" reset — they keep signing in
            with the same account and land back in setup to pick a new passphrase.
          </span>
        </label>

        <div className="mt-4 rounded-xl border border-danger-line bg-danger-surface p-4">
          <p className="text-xs leading-relaxed text-danger-ink">
            Type <span className="font-bold">DELETE</span> to confirm.
          </p>
          <input
            type="text"
            aria-label="Delete user confirmation"
            className="mt-2 w-full rounded-md border border-danger-line bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-danger-ink"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs leading-relaxed text-danger-ink">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={() => void handleDelete()} disabled={!canDelete || submitting}>
            {submitting ? "Deleting…" : alsoDeleteLogin ? "Delete user" : "Wipe data"}
          </Button>
        </div>
      </div>
    </BaseModal>
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

function GrowthTable({ data }: { data: PmfDashboard }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <Th>Week of</Th>
            <Th align="right">Active</Th>
            <Th align="right">New</Th>
            <Th align="right">Retained</Th>
            <Th align="right">Back</Th>
            <Th align="right">Churned</Th>
            <Th align="right">Quick ratio</Th>
          </tr>
        </thead>
        <tbody>
          {data.growth.map((week) => (
            <tr key={week.weekStartDay} className={week.partial ? "text-app-ink-faint" : undefined}>
              <Td>
                {formatDate(week.weekStartDay * DAY_MS)}
                {week.partial && <span className="ml-1.5 text-[10px] text-app-ink-faint">so far</span>}
              </Td>
              <Td align="right" className="font-bold">
                {week.active}
              </Td>
              <Td align="right">{week.new}</Td>
              <Td align="right">{week.retained}</Td>
              <Td align="right">{week.resurrected}</Td>
              <Td align="right" className={week.churned > 0 ? "text-red-600" : undefined}>
                {week.churned}
              </Td>
              <Td
                align="right"
                className={cn(week.quickRatio !== null && (week.quickRatio >= 1 ? "text-emerald-600" : "text-red-600"))}
              >
                {week.quickRatio ?? "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PowerCurve({ data }: { data: PmfDashboard }) {
  const max = Math.max(1, ...data.powerCurve);
  const total = data.powerCurve.reduce((sum, n) => sum + n, 0);
  if (total === 0) return <p className="text-xs text-app-ink-faint">Nobody active in the last 28 days.</p>;
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Users by number of active days in the last 28">
        {data.powerCurve.map((users, index) => (
          <div key={index} className="flex h-full flex-1 flex-col justify-end" title={`${index + 1} days: ${users} users`}>
            <div
              className={cn("w-full rounded-t-sm", index >= 14 ? "bg-emerald-500" : "bg-app-ink/50")}
              style={{ height: `${(users / max) * 100}%`, minHeight: users > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-app-ink-faint">
        <span>1 day</span>
        <span>14</span>
        <span>28 days</span>
      </div>
    </div>
  );
}

function AcquisitionTable({ data }: { data: PmfDashboard }) {
  const { sources, untracked } = data.acquisition;
  if (sources.length === 0) {
    return (
      <p className="text-xs text-app-ink-faint">
        No tracked signups yet. Tracking started on 2026-09-25; {plural(untracked, "user")} signed up before it.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th align="right">Signups</Th>
            <Th align="right">Activated</Th>
            <Th align="right">Active 7d</Th>
          </tr>
        </thead>
        <tbody>
          {sources.map((row) => (
            <tr key={row.source}>
              <Td>{row.source}</Td>
              <Td align="right" className="font-bold">
                {row.signups}
              </Td>
              <Td align="right">{ofTotal(row.activated, row.signups)}</Td>
              <Td align="right">{ofTotal(row.activeLast7, row.signups)}</Td>
            </tr>
          ))}
          <tr>
            <Td className="text-app-ink-faint">Before tracking</Td>
            <Td align="right" className="text-app-ink-faint">
              {untracked}
            </Td>
            <Td>{null}</Td>
            <Td>{null}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GoalsTable({ data }: { data: PmfDashboard }) {
  const { rows, answered, unanswered } = data.goals;
  if (rows.length === 0) {
    return <p className="text-xs text-app-ink-faint">Nobody has picked a goal yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr>
            <Th>Came for</Th>
            <Th align="right">Users</Th>
            <Th align="right">Activated</Th>
            <Th align="right">Active 7d</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.goal}>
              <Td>{row.label}</Td>
              <Td align="right" className="font-bold">
                {row.users}
              </Td>
              <Td align="right">{ofTotal(row.activated, row.users)}</Td>
              <Td align="right">{ofTotal(row.activeLast7, row.users)}</Td>
            </tr>
          ))}
          <tr>
            <Td className="text-app-ink-faint">No answer</Td>
            <Td align="right" className="text-app-ink-faint">
              {unanswered}
            </Td>
            <Td>{null}</Td>
            <Td>{null}</Td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-app-ink-faint">{plural(answered, "user")} answered. People can pick several, so rows overlap.</p>
    </div>
  );
}

/** Last 28 days, oldest first: grey opened, dark wrote. */
function ActivityStrip({ days }: { days: number[] }) {
  return (
    <span className="inline-flex gap-px" aria-label={`Active on ${days.filter((d) => d > 0).length} of the last 28 days`}>
      {days.map((level, index) => (
        <span
          key={index}
          className={cn(
            "inline-block h-3 w-1 rounded-sm",
            level === 2 ? "bg-app-ink" : level === 1 ? "bg-app-ink/30" : "bg-app-line",
          )}
        />
      ))}
    </span>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
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

/**
 * Fetched once, with an explicit Refresh, not subscribed: a subscription re-ran
 * on every write by any user while this tab was open. Each load first folds any
 * activity since the last hourly roll-up into `userDays` (`catchUpNow`, which
 * only reads the new rows), so the numbers are current.
 */
function useDashboardSnapshot() {
  const convex = useConvex();
  const catchUpNow = useAction(api.adminRollup.catchUpNow);
  const [data, setData] = useState<PmfDashboard | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let alive = true;
    setRefreshing(true);
    catchUpNow({})
      // A failed catch-up still leaves the last hourly roll-up to show.
      .catch(() => undefined)
      .then(() => convex.action(api.adminMetrics.getDashboard, {}))
      .then((next) => {
        if (alive) setData(next);
      })
      .catch((err: unknown) => {
        if (alive) setError(err);
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [catchUpNow, convex, requestId]);

  // Same failure mode the subscription had: surface to the route's error boundary.
  if (error) throw error;
  return { data, refreshing, refresh: () => setRequestId((id) => id + 1) };
}

export function AdminDashboardScreen() {
  const { data, refreshing, refresh } = useDashboardSnapshot();
  const { directory, error: directoryError } = useUserDirectory();
  const [deletingUser, setDeletingUser] = useState<PmfDashboard["users"][number] | null>(null);

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

  // Signups (the true top of the funnel) only exist in Clerk — see
  // activationFunnel()'s doc comment for why `getDashboard` can't compute this
  // itself. Falls back to null while the directory action is still loading or
  // failed, which activationFunnel() turns into "don't render this section"
  // rather than a fabricated top stage.
  const adminSubjects = new Set(data.adminUserIds.map(clerkSubject));
  const signups = directory
    ? [...directory.keys()].filter((subject) => !adminSubjects.has(subject)).length
    : null;
  const funnelStages = activationFunnel(data, signups);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-app-ink">Product health</h1>
          <p className="mt-1 text-xs text-app-ink-faint">
            Every figure below excludes your own account unless labelled otherwise. Active means opened the app or
            wrote something. Generated {new Date(data.generatedAt).toLocaleString()}.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {data.scaleFuse.nearLimit && (
        <div className="mt-5 rounded-app-card border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="text-[11px] font-medium uppercase opacity-80">Scale warning</p>
          <p className="mt-0.5 text-sm">
            The daily roll-up this page reads (`{data.scaleFuse.largestTable}`) is at{" "}
            {data.scaleFuse.rowCount.toLocaleString()} rows, past the {data.scaleFuse.warnAt.toLocaleString()}-row
            warning line. Time to add a monthly roll-up on top of it so each load stays small.
          </p>
        </div>
      )}

      {verdict && verdictStyle && (
        <div className={cn("mt-5 rounded-app-card border p-4", verdictStyle.className)}>
          <p className="text-[11px] font-medium uppercase opacity-80">Verdict</p>
          <p className="mt-0.5 text-base font-bold">{verdict.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">{verdict.summary}</p>
        </div>
      )}

      <Section
        title="Activation funnel"
        hint={
          funnelStages
            ? "Signups come from Clerk (the true top of the funnel); the rest come from Convex. Biggest drop-off is the stage to watch."
            : directoryError
              ? `Signup count unavailable — could not load user identities from Clerk: ${directoryError}`
              : "Loading signup count from Clerk…"
        }
      >
        {funnelStages && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {funnelStages.map((stage, index) => (
              <StatCard
                key={stage.id}
                label={stage.label}
                value={stage.value}
                sub={index === 0 ? undefined : `${ofTotal(stage.value, funnelStages[index - 1].value)} from the previous step`}
                tone={index > 0 && stage.pctOfPrevious !== null && stage.pctOfPrevious < 50 ? "bad" : "neutral"}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={`North star: ${data.northStar.label.toLowerCase()}`} hint={data.northStar.definition + ". The one number to move."}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="This week"
            value={data.northStar.thisWeek}
            sub={`${data.northStar.lastWeek} the week before`}
            tone={data.northStar.thisWeek >= data.northStar.lastWeek ? "good" : "bad"}
          />
          <StatCard label="Daily actives" value={data.activeUsers.dauAvg7} sub={`average over 7 days · ${data.activeUsers.dau} today`} />
          <StatCard label="Weekly / 28-day actives" value={`${data.activeUsers.wau} / ${data.activeUsers.mau}`} />
          <StatCard
            label="Stickiness"
            value={`${data.activeUsers.stickiness}%`}
            sub="daily ÷ 28-day actives"
            tone={data.activeUsers.stickiness >= 30 ? "good" : data.activeUsers.stickiness < 15 ? "bad" : "neutral"}
          />
        </div>
      </Section>

      <Section
        title="Activation"
        hint={`Activated means ${data.activation.rule.minItems}+ items across ${data.activation.rule.minTypes}+ types within ${data.activation.rule.windowDays} days of signing up. Users still inside their first week aren't counted either way yet.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Activated"
            value={data.activation.activated}
            sub={`${ofTotal(data.activation.activated, data.activation.eligible)} past their first week`}
            tone={pct(data.activation.activated, data.activation.eligible) >= 50 ? "good" : "bad"}
          />
          <StatCard label="In their first week" value={data.activation.inWindow} sub="not decided yet" />
          <StatCard
            label="Time to activate"
            value={data.activation.medianDaysToActivate === null ? "—" : `${data.activation.medianDaysToActivate}d`}
            sub="median, from signup"
          />
          <StatCard
            label="Still here at 30 days"
            value={`${data.activation.retention30.activated.retained} vs ${data.activation.retention30.notActivated.retained}`}
            sub={`activated (of ${data.activation.retention30.activated.eligible}) vs not (of ${data.activation.retention30.notActivated.eligible})`}
          />
        </div>
      </Section>

      <Section
        title="Growth accounting"
        hint="Each week's actives split into new, retained from the week before, back after a gap, and last week's actives who didn't return. Quick ratio = (new + back) ÷ churned; above 1 is growing."
      >
        <GrowthTable data={data} />
      </Section>

      <Section
        title="Power user curve"
        hint="How many of the last 28 days each active user showed up. A second hump on the right (green, 15+ days) is a habit forming."
      >
        <PowerCurve data={data} />
      </Section>

      <Section title="Headline" hint="Onboarded means the user completed end-to-end encryption setup.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Onboarded" value={data.funnel.onboarded} />
          <StatCard label="Ever created" value={data.funnel.everCreated} sub={`${ofTotal(data.funnel.everCreated, data.funnel.onboarded)} onboarded`} />
          <StatCard
            label="Returned day 2"
            value={data.funnel.returnedDay2}
            sub={`${ofTotal(data.funnel.returnedDay2, data.funnel.onboarded)} onboarded`}
            tone={pct(data.funnel.returnedDay2, data.funnel.onboarded) < 40 ? "bad" : "good"}
          />
          <StatCard label="Active 7d" value={data.funnel.activeLast7} sub={`of ${data.funnel.activeLast30} active in 30d`} />
          <StatCard label="Active 30d" value={data.funnel.activeLast30} />
          <StatCard
            label="Dormant 30d+"
            value={data.funnel.dormant30Plus}
            tone={data.funnel.dormant30Plus > active / 2 ? "bad" : "neutral"}
          />
        </div>
      </Section>

      <Section
        title="Reading vs. writing"
        hint="Of the users active in the last 7 days, how many wrote something and how many only opened the app."
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
                  {ofTotal(bucket.retained, bucket.eligible)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="1 day only" value={dist.oneDay} tone="bad" sub={`${ofTotal(dist.oneDay, active)} active`} />
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
            <p className="mb-2 text-[11px] font-medium uppercase text-app-ink-faint">Modules</p>
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
            <p className="mb-2 text-[11px] font-medium uppercase text-app-ink-faint">Features</p>
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

        <p className="mb-2 mt-6 text-[11px] font-medium uppercase text-app-ink-faint">
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
        title="Where signups come from"
        hint="First visit's source: a campaign tag (utm_source or ?ref=), else the referring site, else direct. Page views and referrers for visitors who didn't sign up are in Vercel Analytics."
      >
        <AcquisitionTable data={data} />
      </Section>

      <Section
        title="What people came for"
        hint="The optional multi-select on the first onboarding screen. Read it against activation: a goal whose users don't stick is a promise the product isn't keeping."
      >
        <GoalsTable data={data} />
      </Section>

      <Section title="Quality, last 7 days" hint="Crash reports from users other than you. A lost change is an offline write the app had to give up on.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Crash reports" value={data.quality.errors7} tone={data.quality.errors7 > 0 ? "bad" : "good"} />
          <StatCard label="Users affected" value={data.quality.usersWithErrors7} />
          <StatCard label="Lost changes" value={data.quality.lostChanges7} tone={data.quality.lostChanges7 > 0 ? "bad" : "good"} />
        </div>
        {data.quality.topContexts.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-app-ink-muted">
            {data.quality.topContexts.map((row) => (
              <li key={row.context} className="flex justify-between gap-3">
                <span className="truncate font-mono text-[11px]">{row.context}</span>
                <span className="tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Survey — ${data.survey.completed} of ${data.survey.started} completed`}>
        <SurveySection data={data} />
      </Section>

      <Section title={`Feedback (${data.feedback.length})`}>
        <FeedbackList data={data} />
      </Section>

      <Section
        title="All users"
        hint="Sorted by most recent activity. The strip is the last 28 days: dark wrote, grey only opened. At this size, reading these rows is the analysis."
      >
        {directoryError && (
          <p className="mb-2 text-xs text-amber-700">
            Showing user ids — could not load names from Clerk: {directoryError}
          </p>
        )}
        {!directoryError && directory === null && (
          <p className="mb-2 text-xs text-app-ink-faint">Loading names from Clerk…</p>
        )}
        <UsersTable data={data} directory={directory} onRequestDelete={setDeletingUser} />
      </Section>

      <p className="mt-10 text-[11px] leading-relaxed text-app-ink-faint">
        Built from a daily roll-up of activity and app opens, updated hourly and on every load of this page. App
        opens have been recorded since mid-2026; before that only writes were, so older days undercount reading.
      </p>

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          identity={directory?.get(clerkSubject(deletingUser.userId)) ?? null}
          onClose={() => {
            setDeletingUser(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
