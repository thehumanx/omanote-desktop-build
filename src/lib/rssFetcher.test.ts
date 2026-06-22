import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchRssFeed, RssFetchError } from "./rssFetcher";

const VALID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Post 1</title>
      <link>https://example.com/post-1</link>
    </item>
  </channel>
</rss>`;

function mockFetch(handler: (url: string) => Response | Promise<Response> | never) {
  const fn = vi.fn().mockImplementation(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchRssFeed", () => {
  it("throws on empty string", async () => {
    mockFetch(() => new Response());
    await expect(fetchRssFeed("")).rejects.toThrow("Feed URL is required");
    await expect(fetchRssFeed("")).rejects.toBeInstanceOf(RssFetchError);
  });

  it("throws on whitespace-only string", async () => {
    mockFetch(() => new Response());
    await expect(fetchRssFeed("   ")).rejects.toThrow("Feed URL is required");
  });

  it("throws on nullish input", async () => {
    mockFetch(() => new Response());
    await expect(fetchRssFeed(null as unknown as string)).rejects.toThrow("Feed URL is required");
    await expect(fetchRssFeed(undefined as unknown as string)).rejects.toThrow("Feed URL is required");
  });

  it("does not call fetch when feedUrl is invalid", async () => {
    const fetchSpy = mockFetch(() => new Response());
    await expect(fetchRssFeed("")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("trims whitespace from URL before encoding", async () => {
    const fetchSpy = mockFetch(() => new Response(VALID_RSS, { status: 200 }));
    await fetchRssFeed("  https://example.com/feed  ");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("https://example.com/feed"));
    expect(url).not.toContain(" ");
  });

  it("returns parsed feed on success", async () => {
    mockFetch(() => new Response(VALID_RSS, { status: 200 }));
    const result = await fetchRssFeed("https://example.com/feed");
    expect(result.title).toBe("Test Feed");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Post 1");
  });

  it("throws network error on fetch failure", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toThrow("Network error");
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toMatchObject({
      code: "network",
    });
  });

  it("throws parse error for invalid XML", async () => {
    mockFetch(() => new Response("not xml at all", { status: 200 }));
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toThrow("Failed to parse RSS/Atom feed");
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toMatchObject({
      code: "parse",
    });
  });

  it("throws network error on non-ok HTTP status", async () => {
    mockFetch(() => new Response("Not Found", { status: 404, statusText: "Not Found" }));
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toThrow("HTTP 404");
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toMatchObject({
      code: "network",
    });
  });

  it("aborts after timeout", async () => {
    // Mock fetch that aborts when the signal fires
    mockFetch((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const promise = fetchRssFeed("https://example.com/feed");

    vi.advanceTimersByTime(15_000);

    await expect(promise).rejects.toThrow("Request timed out");
    await expect(promise).rejects.toMatchObject({ code: "network" });
  });

  it("rejects response exceeding Content-Length limit", async () => {
    const largeSize = 6 * 1024 * 1024;
    const fetchSpy = mockFetch(() => {
      const headers = new Headers({ "content-length": String(largeSize) });
      return new Response("ok", { status: 200, headers });
    });
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toThrow("Response too large");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects response exceeding streaming body limit", async () => {
    const chunk = new Uint8Array(1024 * 1024); // 1MB
    let callCount = 0;
    mockFetch(() => {
      callCount = 0;
      const stream = new ReadableStream({
        pull(controller) {
          callCount++;
          if (callCount <= 6) {
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        },
      });
      return new Response(stream, { status: 200 });
    });
    await expect(fetchRssFeed("https://example.com/feed")).rejects.toThrow("Response too large");
  });
});
