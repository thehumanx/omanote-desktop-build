import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveModal } from "./SaveModal";

vi.mock("../popup/components/SaveForm", () => ({
  SaveForm: ({ initialContent }: { initialContent: string }) => (
    <div data-testid="save-form">{initialContent}</div>
  ),
}));

describe("SaveModal message security", () => {
  beforeEach(() => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://trusted.example/article",
    });
  });

  it("posts modal lifecycle messages only to the embedding page origin", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    render(<SaveModal />);

    expect(postMessage).toHaveBeenCalledWith({ type: "OMANOTE_MODAL_READY" }, "https://trusted.example");
  });

  it("ignores modal init messages from untrusted origins", () => {
    render(<SaveModal />);

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "OMANOTE_MODAL_INIT",
        context: {
          selectedText: "stolen text",
          selectedUrl: undefined,
          pageUrl: "https://evil.example",
          pageTitle: "Evil",
          triggeredBy: "selection",
        },
      },
      origin: "https://evil.example",
      source: window.parent,
    }));

    expect(screen.queryByTestId("save-form")).toBeNull();
  });

  it("accepts modal init messages from the trusted embedding origin", async () => {
    render(<SaveModal />);

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "OMANOTE_MODAL_INIT",
        context: {
          selectedText: "trusted text",
          selectedUrl: undefined,
          pageUrl: "https://trusted.example/article",
          pageTitle: "Trusted",
          triggeredBy: "selection",
        },
      },
      origin: "https://trusted.example",
      source: window.parent,
    }));

    expect((await screen.findByTestId("save-form")).textContent).toContain("trusted text");
  });
});
