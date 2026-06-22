import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./[shareCode]";

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers = new Map<string, string | number | readonly string[]>();
  body = "";

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name, value);
    return this;
  }

  end(chunk?: unknown) {
    if (chunk !== undefined) {
      this.body += String(chunk);
    }
    this.emit("finish");
    return this;
  }
}

function createRequest(url: string, host: string): IncomingMessage {
  return {
    url,
    headers: { host },
  } as IncomingMessage;
}

describe("shared folder API page shell", () => {
  const originalAppOrigin = process.env.APP_ORIGIN;

  afterEach(() => {
    if (originalAppOrigin === undefined) {
      delete process.env.APP_ORIGIN;
    } else {
      process.env.APP_ORIGIN = originalAppOrigin;
    }
  });

  it("self-fetches the known app origin instead of Host or APP_ORIGIN", async () => {
    process.env.APP_ORIGIN = "https://misconfigured.example";
    const fetchMock = vi.fn(async () => new Response("<html><title>omanote</title></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = new MockResponse();

    await handler(
      createRequest("/s/shared-code?shareCode=shared-code", "attacker.example"),
      response as unknown as ServerResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith("https://omanote.iambishistha.com/index.html");
    expect(fetchMock).not.toHaveBeenCalledWith("https://attacker.example/index.html");
    expect(fetchMock).not.toHaveBeenCalledWith("https://misconfigured.example/index.html");
  });
});
