# Design System Changelog

Machine-readable log of breaking and deprecating changes to design-system
**tokens, shared primitives, and their props** — not the product. For
user-facing history, see [`CHANGELOG.md`](../../CHANGELOG.md) at the repo
root; that file is written for end users and should stay that way.

This file exists so a coding agent (or a human) can answer "is X still
valid?" by reading one place, without cross-referencing git history or
guessing from a prose changelog. Entries are append-only, most recent first.

## Format

Each entry is one of:

- `Renamed`: old identifier no longer exists; type errors immediately if used.
- `Deprecated`: old identifier still works but is scheduled for removal;
  source carries a `@deprecated` JSDoc tag pointing here.
- `Removed`: old identifier no longer exists and had no direct replacement.

```
## YYYY-MM-DD
- **Renamed** `Component.propName` → `Component.newPropName`. <why>. <migration note>.
```

## 2026-09-04

- **Renamed** `Button.tone` → `Button.variant`. Values unchanged
  (`"default" | "plain" | "ghost" | "soft" | "danger" | "dangerGhost"`).
  `tone` no longer exists on `Button`'s prop type — passing it is a
  compile-time error, not a silent no-op. Renamed to align with the
  `variant` convention used by shadcn/MUI/Chakra, which is what most
  AI-generated code reaches for by default; see `AGENTS.md`.
- **Renamed** `Badge.tone` → `Badge.variant`. Values unchanged
  (`"muted" | "outline" | "success" | "danger"`).
- **Renamed** `Chip.tone` → `Chip.variant`. Values unchanged, shares
  `Badge`'s variant set.
- Not affected by the above, despite the name collision: `Toast.tone`
  (`src/app/types.ts`) and `InsightSeverity.tone`
  (`src/screens/admin/pmf-insights.ts`) — these describe notification/insight
  *severity*, not a component visual style, and were intentionally left as
  `tone`.
