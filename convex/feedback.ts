import { ConvexError, v } from "convex/values";
import { internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserId } from "./utils";

export const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_MAX_LENGTH = 320;
const USER_AGENT_MAX_LENGTH = 400;
const APP_VERSION_MAX_LENGTH = 60;

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT_MAX_PER_WINDOW = 5;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const submit = mutation({
  args: {
    message: v.string(),
    type: v.union(v.literal("feedback"), v.literal("feature")),
    anonymous: v.boolean(),
    email: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to send feedback.");
    }
    const userId = requireUserId(identity);

    const message = args.message.trim();
    if (!message) {
      throw new ConvexError("Feedback message cannot be empty.");
    }
    if (message.length > MESSAGE_MAX_LENGTH) {
      throw new ConvexError(
        `Feedback is too long — please keep it under ${MESSAGE_MAX_LENGTH} characters.`,
      );
    }
    if (args.email && args.email.length > EMAIL_MAX_LENGTH) {
      throw new ConvexError("Email address is too long.");
    }

    const now = Date.now();
    const rateLimit = await ctx.db
      .query("feedbackRateLimits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!rateLimit || now - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS) {
      if (rateLimit) {
        await ctx.db.patch(rateLimit._id, { windowStart: now, count: 1 });
      } else {
        await ctx.db.insert("feedbackRateLimits", { userId, windowStart: now, count: 1 });
      }
    } else if (rateLimit.count >= RATE_LIMIT_MAX_PER_WINDOW) {
      throw new ConvexError(
        "You've sent a lot of feedback recently — please try again in a little while.",
      );
    } else {
      await ctx.db.patch(rateLimit._id, { count: rateLimit.count + 1 });
    }

    // Truncate metadata rather than rejecting — it's diagnostic, not content.
    const email = args.anonymous ? undefined : args.email;
    const userAgent = args.userAgent?.slice(0, USER_AGENT_MAX_LENGTH);
    const appVersion = args.appVersion?.slice(0, APP_VERSION_MAX_LENGTH);

    await ctx.db.insert("feedback", {
      message,
      type: args.type,
      anonymous: args.anonymous,
      email,
      userAgent,
      appVersion,
    });

    await ctx.scheduler.runAfter(0, internal.feedback.sendEmail, {
      message,
      type: args.type,
      anonymous: args.anonymous,
      email,
      userAgent,
      appVersion,
    });
  },
});

export const sendEmail = internalAction({
  args: {
    message: v.string(),
    type: v.union(v.literal("feedback"), v.literal("feature")),
    anonymous: v.boolean(),
    email: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    appVersion: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[feedback] RESEND_API_KEY is not set — skipping email");
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "feedback@omanote.app";
    const toEmail = "namaste@iambishistha.com";
    const typeLabel = args.type === "feature" ? "Feature Request" : "Feedback";
    const sender = args.anonymous ? "Anonymous" : (args.email ?? "Anonymous");
    // User-controlled values must be escaped before HTML interpolation, and
    // kept to a single line in the subject header.
    const safeSender = escapeHtml(sender);
    const subjectSender = sender.replace(/[\r\n]+/g, " ").slice(0, 120);
    const safeMessage = escapeHtml(args.message).replace(/\n/g, "<br>");
    const safeUserAgent = args.userAgent ? escapeHtml(args.userAgent) : undefined;
    const safeAppVersion = args.appVersion ? escapeHtml(args.appVersion) : undefined;

    const htmlBody = `
      <h2 style="margin-bottom:4px">${typeLabel}</h2>
      <p style="margin:0 0 16px;color:#666">Submitted via omanote</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr>
          <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">From</td>
          <td style="padding:6px 0">${safeSender}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">Type</td>
          <td style="padding:6px 0">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">Message</td>
          <td style="padding:6px 0">${safeMessage}</td>
        </tr>
        ${safeUserAgent ? `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">User Agent</td><td style="padding:6px 0;color:#aaa;font-size:12px">${safeUserAgent}</td></tr>` : ""}
        ${safeAppVersion ? `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">App Version</td><td style="padding:6px 0;color:#aaa;font-size:12px">${safeAppVersion}</td></tr>` : ""}
      </table>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `omanote Feedback <${fromEmail}>`,
        to: toEmail,
        subject: `[omanote] ${typeLabel} from ${subjectSender}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[feedback] Resend error ${res.status}: ${body}`);
    }
  },
});
