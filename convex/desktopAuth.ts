import { ConvexError } from "convex/values";
import { action } from "./_generated/server";

/**
 * Mints a single-use Clerk sign-in token for the calling (already signed-in)
 * user. The website's /auth/desktop page calls this and hands the token to
 * the desktop app via the omanote:// deep link, where it is exchanged for a
 * session with Clerk's "ticket" sign-in strategy.
 *
 * Requires the CLERK_SECRET_KEY environment variable on the deployment.
 */
export const createSignInToken = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to connect the desktop app.");
    }
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new ConvexError(
        "Desktop sign-in is not configured on the server (missing CLERK_SECRET_KEY).",
      );
    }

    const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // For Clerk JWTs the subject claim is the Clerk user id.
        user_id: identity.subject,
        expires_in_seconds: 300,
      }),
    });

    if (!response.ok) {
      console.error("Clerk sign-in token request failed", response.status, await response.text());
      throw new ConvexError("Could not create a desktop sign-in token. Please try again.");
    }

    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      throw new ConvexError("Clerk did not return a sign-in token.");
    }
    return { token: data.token };
  },
});
