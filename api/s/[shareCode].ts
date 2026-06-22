import type { IncomingMessage, ServerResponse } from "node:http";

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? "";
const APP_ORIGIN = "https://omanote.iambishistha.com";

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Extract shareCode from path — Vercel appends it as a query param for dynamic routes
  const rawUrl = req.url ?? "/";
  const qs = new URLSearchParams(rawUrl.includes("?") ? rawUrl.split("?")[1] : "");
  const shareCode =
    qs.get("shareCode") ??
    rawUrl.split("?")[0].split("/").filter(Boolean).pop() ??
    "";

  let title = "omanote | Shared folder";
  let description = "A shared bookmark folder on omanote.";

  if (shareCode && CONVEX_URL) {
    try {
      const convexRes = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "sharedFolders:getPublicShare",
          args: { shareCode },
        }),
      });

      if (convexRes.ok) {
        const result = (await convexRes.json()) as {
          status: string;
          value?: { categoryName: string; ownerName: string } | null;
        };
        const data = result.value;
        if (data) {
          const firstName = data.ownerName.split(" ")[0];
          title = `omanote | ${data.categoryName} by ${firstName}`;
          description = `${data.categoryName} — a shared bookmark folder by ${data.ownerName} on omanote.`;
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  // Self-fetch index.html so we always serve the current build's assets.
  // Host header is intentionally not used — it can be spoofed. Domain is hardcoded.
  let html: string;
  try {
    const htmlRes = await fetch(`${APP_ORIGIN}/index.html`);
    html = await htmlRes.text();
  } catch {
    res.statusCode = 500;
    res.end("Internal Server Error");
    return;
  }

  const safeTitle = escapeAttr(title);
  const safeDesc = escapeAttr(description);

  const modified = html
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/g, `$1${safeTitle}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/g, `$1${safeDesc}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/g, `$1${safeTitle}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/g, `$1${safeDesc}$2`);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.end(modified);
}
