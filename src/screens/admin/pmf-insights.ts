import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type PmfDashboard = FunctionReturnType<typeof api.adminMetrics.getDashboard>;

export type InsightSeverity = "critical" | "warning" | "ok" | "info";

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  /** What the data says, with the numbers inline. */
  detail: string;
  /** What to do about it. */
  suggestion: string;
};

export const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

// ─── Small helpers ────────────────────────────────────────────────────────────

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Sean Ellis: share of survey respondents who'd be "very disappointed". */
export function seanEllisScore(data: PmfDashboard): { veryDisappointed: number; answered: number } | null {
  const question = data.survey.questions.find((q) => q.questionId === "pmf");
  if (!question) return null;
  const answered = question.choices.reduce((sum, c) => sum + c.count, 0);
  if (answered === 0) return null;
  const veryDisappointed = question.choices.find((c) => c.value === "very_disappointed")?.count ?? 0;
  return { veryDisappointed, answered };
}

/** Users active in the newest month who signed up in an earlier month. */
export function latestMonthReturn(data: PmfDashboard): {
  month: string;
  returning: number;
  priorCohortSize: number;
} | null {
  if (data.monthly.length < 2) return null;
  const latest = data.monthly[data.monthly.length - 1];
  const priorCohortSize = data.monthly
    .slice(0, data.monthly.length - 1)
    .reduce((sum, m) => sum + m.signups, 0);
  if (priorCohortSize === 0) return null;
  return { month: latest.month, returning: latest.returning, priorCohortSize };
}

/**
 * Non-admin users who have ever created something. The server already computes
 * this as `funnel.everCreated`; deriving it a second time from `users` would
 * be a second source of truth that can silently drift.
 */
export function totalActiveUsers(data: PmfDashboard): number {
  return data.funnel.everCreated;
}

// ─── Insight rules ────────────────────────────────────────────────────────────
//
// Each rule reads the dashboard payload and returns an insight or null. They
// are deliberately threshold-based and boring: the point is that the verdict
// changes on its own as the numbers change, rather than being a snapshot of
// one analysis session.

type Rule = (data: PmfDashboard) => Insight | null;

const oneDayOnlyRule: Rule = (data) => {
  const dist = data.daysActiveDistribution;
  const active = totalActiveUsers(data);
  if (active === 0) return null;
  const share = pct(dist.oneDay, active);
  if (share < 25) {
    return {
      id: "one-day-only",
      severity: "ok",
      title: "Most users come back a second day",
      detail: `${share}% of active users (${dist.oneDay}/${active}) only ever used the app on one day.`,
      suggestion: "Keep watching this — it's the single best early PMF indicator you have.",
    };
  }
  return {
    id: "one-day-only",
    severity: share >= 40 ? "critical" : "warning",
    title: "Half the base never returns for a second day",
    detail: `${share}% of active users (${dist.oneDay}/${active}) used the app on exactly one day, ever. Only ${plural(dist.tenPlus, "user")} reached 10+ active days.`,
    suggestion:
      "This is an activation problem, not a feature gap. Interview the one-day users and ask what they opened the app to do and what they did instead. Adding features will not move this number.",
  };
};

const longRetentionRule: Rule = (data) => {
  const bucket = data.retentionBuckets.find((b) => b.lo === 31);
  if (!bucket || bucket.eligible === 0) return null;
  const share = pct(bucket.retained, bucket.eligible);
  if (share >= 25) {
    return {
      id: "d30-retention",
      severity: "ok",
      title: "Day-30 retention is holding",
      detail: `${share}% (${bucket.retained}/${bucket.eligible}) of eligible users were still active 31+ days after first use.`,
      suggestion: "The curve is flattening above zero. Focus shifts to acquisition.",
    };
  }
  return {
    id: "d30-retention",
    severity: share < 15 ? "critical" : "warning",
    title: "The retention curve decays toward zero",
    detail: `Only ${share}% (${bucket.retained}/${bucket.eligible}) of eligible users were still active 31+ days after their first activity.`,
    suggestion:
      "A daily workspace needs the curve to flatten, not decay. Until it does, treat every new feature as a distraction from the habit loop.",
  };
};

const founderShareRule: Rule = (data) => {
  const { adminEvents, totalEvents } = data.founderShare;
  if (totalEvents === 0) return null;
  const share = pct(adminEvents, totalEvents);
  if (share < 35) {
    return {
      id: "founder-share",
      severity: "ok",
      title: "Usage is no longer founder-dominated",
      detail: `Your own account is ${share}% of all recorded activity.`,
      suggestion: "Product intuition is now being calibrated on real users. Good.",
    };
  }
  return {
    id: "founder-share",
    severity: share >= 60 ? "critical" : "warning",
    title: "You are most of the usage",
    detail: `Your own account accounts for ${share}% of all recorded activity (${adminEvents.toLocaleString()} of ${totalEvents.toLocaleString()} events).`,
    suggestion:
      "Your product intuition is being calibrated on a sample of one. Default every chart to excluding yourself, and weight user interviews over your own daily experience.",
  };
};

const leakyBucketRule: Rule = (data) => {
  const latest = latestMonthReturn(data);
  if (!latest) return null;
  const share = pct(latest.returning, latest.priorCohortSize);
  if (share >= 35) {
    return {
      id: "leaky-bucket",
      severity: "ok",
      title: "Existing users keep showing up",
      detail: `${latest.returning} of ${latest.priorCohortSize} users who signed up before ${latest.month} were active during it (${share}%).`,
      suggestion: "The bucket is holding. Pour more in.",
    };
  }
  return {
    id: "leaky-bucket",
    severity: share < 20 ? "critical" : "warning",
    title: "Leaky bucket — monthly actives are flat while signups compound",
    detail: `Only ${latest.returning} of the ${latest.priorCohortSize} users who signed up before ${latest.month} came back during it (${share}%). New signups are replacing churned users rather than adding to them.`,
    suggestion:
      "More acquisition will not compound until this number rises. Fix retention before spending anything on growth.",
  };
};

const seanEllisRule: Rule = (data) => {
  const score = seanEllisScore(data);
  if (!score) return null;
  const share = pct(score.veryDisappointed, score.answered);
  const smallSample = score.answered < 20;
  if (share >= 40) {
    return {
      id: "sean-ellis",
      severity: smallSample ? "info" : "ok",
      title: "Sean Ellis score is above the PMF threshold",
      detail: `${share}% of ${plural(score.answered, "respondent")} would be very disappointed without omanote.${smallSample ? " Sample is too small to be statistically meaningful yet." : ""}`,
      suggestion: smallSample ? "Get the survey in front of more users to confirm." : "Double down on whoever these users are.",
    };
  }
  return {
    id: "sean-ellis",
    severity: smallSample ? "warning" : "critical",
    title: `Sean Ellis score is ${share}% (threshold is 40%)`,
    detail: `${score.veryDisappointed} of ${plural(score.answered, "respondent")} said they'd be "very disappointed" if omanote went away.${smallSample ? " With this few responses it's directional, not statistical." : ""}`,
    suggestion:
      smallSample
        ? "Push the survey harder — you cannot make a PMF call on this sample size. Prompt every user with 2+ active days."
        : "Segment the very-disappointed users and find what they have in common. Build only for them.",
  };
};

const monetizationRule: Rule = (data) => {
  if (data.funnel.paying > 0) {
    return {
      id: "monetization",
      severity: "ok",
      title: "Revenue exists",
      detail: `${plural(data.funnel.paying, "user")} on a paid plan.`,
      suggestion: "Track conversion rate from active to paid as the next core metric.",
    };
  }
  const wtp = data.survey.questions.find((q) => q.questionId === "willingness_to_pay");
  const wtpNote = wtp
    ? ` Survey willingness-to-pay: ${wtp.choices.map((c) => `${c.value} (${c.count})`).join(", ")}.`
    : "";
  return {
    id: "monetization",
    severity: "warning",
    title: "No monetization path exists yet",
    detail: `Zero users on a paid plan and no billing integration is wired up, so willingness to pay is entirely untested.${wtpNote}`,
    suggestion:
      "Don't build billing yet — retention comes first. But do ask price directly in user interviews so you're not guessing later.",
  };
};

const organicAcquisitionRule: Rule = (data) => {
  const discovery = data.survey.questions.find((q) => q.questionId === "discovery");
  if (!discovery) return null;
  const total = discovery.choices.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;
  const fromFounder = discovery.choices.find((c) => c.value === "founder")?.count ?? 0;
  const share = pct(fromFounder, total);
  if (share < 70) {
    return {
      id: "organic",
      severity: "ok",
      title: "Some users arrive on their own",
      detail: `${100 - share}% of respondents found omanote through a channel other than you directly.`,
      suggestion: "Find which channel and lean into it.",
    };
  }
  return {
    id: "organic",
    severity: share === 100 ? "critical" : "warning",
    title: "There is no organic pull",
    detail: `${share}% of survey respondents (${fromFounder}/${total}) found omanote directly through you. Every user is someone you told.`,
    suggestion:
      "Word of mouth is the cheapest PMF test there is. If retained users aren't referring anyone, they don't love it enough yet — that's information, not a marketing problem.",
  };
};

const todoCloseRateRule: Rule = (data) => {
  const { othersCreated, othersCompleted, adminCreated, adminCompleted } = data.todoFunnel;
  if (othersCreated < 20) return null;
  const otherRate = pct(othersCompleted, othersCreated);
  const adminRate = pct(adminCompleted, adminCreated);
  if (otherRate >= 65) {
    return {
      id: "todo-close-rate",
      severity: "ok",
      title: "Users actually close their todos",
      detail: `${otherRate}% close rate (${othersCompleted}/${othersCreated}) for non-founder users.`,
      suggestion: "People are running real work through it. Protect this flow above all others.",
    };
  }
  return {
    id: "todo-close-rate",
    severity: otherRate < 50 ? "warning" : "info",
    title: "Todos get created but not closed",
    detail: `Non-founder close rate is ${otherRate}% (${othersCompleted}/${othersCreated}) versus your own ${adminRate}% (${adminCompleted}/${adminCreated}).`,
    suggestion:
      "A gap this size is the signature of \"tried it, kept using the old tool\". Ask interviewees what they still keep their real task list in.",
  };
};

const unusedFeatureRule: Rule = (data) => {
  const active = totalActiveUsers(data);
  const dead = data.featureAdoption.filter((f) => f.users <= Math.max(2, Math.round(active * 0.1)));
  if (dead.length === 0) return null;
  return {
    id: "unused-features",
    severity: dead.length >= 3 ? "warning" : "info",
    title: "Shipped surface area nobody uses",
    detail: `${dead.length} of ${data.featureAdoption.length} tracked features are used by ≤${Math.max(2, Math.round(active * 0.1))} users: ${dead.map((f) => `${f.label} (${f.users})`).join(", ")}.`,
    suggestion:
      "Every one of these carries schema, UI and maintenance cost forever. Cut or hide the ones with zero pull rather than polishing them.",
  };
};

const moduleBreadthRule: Rule = (data) => {
  const active = data.users.filter((u) => !u.isAdmin && u.events > 0);
  if (active.length === 0) return null;
  const single = active.filter((u) => u.modulesUsed <= 1).length;
  const share = pct(single, active.length);
  if (share < 30) {
    return {
      id: "module-breadth",
      severity: "ok",
      title: "Users adopt more than one module",
      detail: `Only ${share}% of active users touched a single module.`,
      suggestion: "Breadth of adoption is a good sign they're moving real life in.",
    };
  }
  return {
    id: "module-breadth",
    severity: "info",
    title: "Adoption is narrow",
    detail: `${share}% of active users (${single}/${active.length}) only ever created in one module.`,
    suggestion:
      "Either the onboarding doesn't reveal the other modules, or the all-in-one pitch isn't what people actually want. Worth asking directly.",
  };
};

const currentlyActiveRule: Rule = (data) => {
  const active = totalActiveUsers(data);
  if (active === 0) return null;
  const share = pct(data.funnel.activeLast7, active);
  return {
    id: "currently-active",
    severity: share < 20 ? "critical" : share < 40 ? "warning" : "ok",
    title: `${data.funnel.activeLast7} of ${active} users were active in the last 7 days`,
    detail: `${data.funnel.dormant30Plus} users have been dormant for 30+ days. For a product positioned as a daily workspace, weekly actives should approach monthly actives.`,
    suggestion:
      share < 40
        ? "Compare WAU/MAU as your north-star ratio. Below ~0.4 the product is not yet a daily habit for anyone but you."
        : "WAU/MAU is healthy for a daily-use tool. Keep it on the wall.",
  };
};

const activationFunnelRule: Rule = (data) => {
  const { onboarded, everCreated, returnedDay2 } = data.funnel;
  if (onboarded === 0) return null;
  return {
    id: "activation-funnel",
    severity: pct(returnedDay2, onboarded) < 40 ? "warning" : "ok",
    title: "Activation funnel",
    detail: `${onboarded} onboarded → ${everCreated} created something (${pct(everCreated, onboarded)}%) → ${returnedDay2} returned on a second day (${pct(returnedDay2, onboarded)}%).`,
    suggestion:
      "activityHistory only records writes, so a read-only session looks like a dormant user. Add lightweight session instrumentation to see where in this funnel people actually drop.",
  };
};

const surveySampleRule: Rule = (data) => {
  const active = totalActiveUsers(data);
  if (data.survey.started >= Math.max(10, active * 0.3)) return null;
  return {
    id: "survey-sample",
    severity: "info",
    title: "Qualitative signal is thin",
    detail: `${plural(data.survey.started, "survey response")} (${data.survey.completed} completed) and ${plural(data.feedback.length, "feedback item")} against ${plural(active, "active user")}.`,
    suggestion:
      "You're making product decisions on almost no qualitative input. Email the dormant users directly — a 15-minute call beats another dashboard.",
  };
};

const RULES: Rule[] = [
  oneDayOnlyRule,
  longRetentionRule,
  leakyBucketRule,
  founderShareRule,
  currentlyActiveRule,
  seanEllisRule,
  todoCloseRateRule,
  activationFunnelRule,
  moduleBreadthRule,
  unusedFeatureRule,
  organicAcquisitionRule,
  monetizationRule,
  surveySampleRule,
];

export function deriveInsights(data: PmfDashboard): Insight[] {
  return RULES.map((rule) => rule(data))
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// ─── Headline verdict ─────────────────────────────────────────────────────────

export type Verdict = {
  label: string;
  tone: InsightSeverity;
  summary: string;
};

export function deriveVerdict(data: PmfDashboard, insights: Insight[]): Verdict {
  const criticals = insights.filter((i) => i.severity === "critical").length;
  const active = totalActiveUsers(data);
  const tenPlus = data.daysActiveDistribution.tenPlus;

  if (active < 10) {
    return {
      label: "Too early to call",
      tone: "info",
      summary: `${plural(active, "user")} with any activity. Anything below ~10 is anecdote, not signal — but the shape of the curve is still worth watching.`,
    };
  }
  if (criticals >= 3) {
    return {
      label: "No product-market fit yet",
      tone: "critical",
      summary: `${criticals} critical signals are failing at once, and only ${plural(tenPlus, "user")} have reached 10+ active days. The bottleneck is activation and habit formation, not missing features.`,
    };
  }
  if (criticals >= 1) {
    return {
      label: "Early signal, serious leaks",
      tone: "warning",
      summary: `Some users are sticking (${plural(tenPlus, "user")} at 10+ active days) but ${criticals} critical signal${criticals === 1 ? "" : "s"} still failing. Close those before adding surface area.`,
    };
  }
  return {
    label: "Signal is trending healthy",
    tone: "ok",
    summary: `${plural(tenPlus, "user")} at 10+ active days and no critical signals failing. Shift focus from retention to acquisition.`,
  };
}
