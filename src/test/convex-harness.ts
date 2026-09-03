/**
 * Test harness wrapper that gives every fake identity an allowed-domain email.
 *
 * `requireUserId` (convex/utils.ts) gates on `isAllowedEmailDomain(identity.email)`
 * as well as `tokenIdentifier`. The suites here were written before that check
 * existed and build identities with a `tokenIdentifier` only, so from v0.31.5
 * (`96a8b44`, "gmail-only access") every one of them threw `Unauthorized`
 * before reaching its assertion — 141 tests across 19 files, all with that one
 * cause. See docs/hardening-audit.md §7.1.
 *
 * Defaulting the email here rather than at the ~82 `withIdentity` call sites
 * keeps the fix to one import line per file, and leaves the domain policy
 * expressed in exactly one place for tests, mirroring `ALLOWED_EMAIL_DOMAINS`
 * for the app. A test that wants to exercise a *blocked* domain still can —
 * passing an explicit `email` overrides the default.
 *
 * **This file must stay outside `convex/`.** Convex bundles every non-test
 * module in that directory and deploys it, so a helper living there would ship
 * `convex-test` (a devDependency) to production. Convex also rejects hyphens
 * in module paths outright — `convex/test-utils.ts` fails `convex codegen`
 * with `InvalidConfig`, which is how this placement was found.
 */

import { convexTest as baseConvexTest } from "convex-test";
import type { SchemaDefinition, GenericSchema } from "convex/server";
import type { UserIdentity } from "convex/server";
import type { TestConvex } from "convex-test";

// Any address whose domain is in ALLOWED_EMAIL_DOMAINS works; the local part is
// irrelevant to the check, so one shared value keeps failures easy to read.
export const TEST_EMAIL = "test@gmail.com";

export function convexTest<Schema extends GenericSchema>(
  schema?: SchemaDefinition<Schema, boolean>,
  modules?: Record<string, () => Promise<unknown>>,
): TestConvex<SchemaDefinition<Schema, boolean>> {
  const t = baseConvexTest(schema, modules as Record<string, () => Promise<never>>);
  const withIdentity = t.withIdentity.bind(t);
  t.withIdentity = (identity: Partial<UserIdentity>) =>
    withIdentity({ email: TEST_EMAIL, ...identity });
  return t;
}
