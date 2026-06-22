const DEFAULT_ALLOWED_ORIGINS = [
  "https://omanote.iambishistha.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

const FETCH_TIMEOUT_MS = 10_000;

export interface Env {
  ALLOWED_ORIGINS?: string;
}

function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  const allowedRaw = env.ALLOWED_ORIGINS;
  const allowed = allowedRaw
    ? allowedRaw.split(",").map((s) => s.trim())
    : DEFAULT_ALLOWED_ORIGINS;
  try {
    const originUrl = new URL(origin);
    return allowed.some((allowedOrigin) => {
      try {
        return new URL(allowedOrigin).origin === originUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function getOriginFromRequest(request: Request): string | null {
  return request.headers.get("Origin") || request.headers.get("Referer");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (!isOriginAllowed(origin, env)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin!,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const requestOrigin = getOriginFromRequest(request);
    if (!isOriginAllowed(requestOrigin, env)) {
      return new Response("Forbidden", { status: 403 });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/proxy") {
      return new Response("Not found", { status: 404 });
    }

    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response("Only http/https URLs allowed", { status: 400 });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent":
              "omanote-rss/1.0 (+https://omanote.iambishistha.com)",
            Accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
          },
          redirect: "follow",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": requestOrigin || "*",
        "Content-Type":
          response.headers.get("Content-Type") || "application/xml",
      };

      return new Response(response.body, {
        status: response.status,
        headers: corsHeaders,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return new Response("Upstream request timed out", { status: 504 });
      }
      return new Response("Failed to fetch target URL", { status: 502 });
    }
  },
};
