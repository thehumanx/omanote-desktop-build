import { act, render, screen } from "@testing-library/react";
import { useRef, useState, type MutableRefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMeasuredHighlight, type HighlightItemRefs } from "./useMeasuredHighlight";

type ResizeObserverEntry = { target: Element };
type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

const observedTargets = new Set<Element>();
let resizeCallback: ResizeObserverCallback | null = null;

class ControllableResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe(target: Element) {
    observedTargets.add(target);
  }

  unobserve(target: Element) {
    observedTargets.delete(target);
  }

  disconnect() {
    observedTargets.clear();
  }
}

function setBox(element: HTMLElement, box: { left: number; top: number; width: number; height: number }) {
  Object.defineProperties(element, {
    offsetLeft: { configurable: true, value: box.left },
    offsetTop: { configurable: true, value: box.top },
    offsetWidth: { configurable: true, value: box.width },
    offsetHeight: { configurable: true, value: box.height },
  });
}

function TestMeasuredHighlight() {
  const [active, setActive] = useState("today");
  const [count, setCount] = useState(1);
  const [hideToday, setHideToday] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<HighlightItemRefs<HTMLButtonElement>>({});
  const style = useMeasuredHighlight({
    activeKey: active,
    containerRef,
    itemRefs: itemRefs as MutableRefObject<HighlightItemRefs<HTMLElement>>,
    layoutKey: count,
  });

  return (
    <div>
      <div ref={containerRef}>
        {["today", "completed"].map((key) => hideToday && key === "today" ? null : (
          <button
            key={key}
            ref={(node) => {
              itemRefs.current[key] = node;
            }}
            type="button"
            onClick={() => setActive(key)}
          >
            {key === "today" ? `Today ${count}` : "Completed"}
          </button>
        ))}
      </div>
      <output data-testid="highlight-style">{JSON.stringify(style)}</output>
      <button type="button" onClick={() => setCount(99)}>
        Change text
      </button>
      <button type="button" onClick={() => {
        setHideToday(true);
        setCount(100);
      }}>
        Hide active
      </button>
    </div>
  );
}

function TestMeasuredHighlightWithoutResizeObservation() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<HighlightItemRefs<HTMLButtonElement>>({});
  const style = useMeasuredHighlight({
    activeKey: "today",
    containerRef,
    itemRefs: itemRefs as MutableRefObject<HighlightItemRefs<HTMLElement>>,
    observeResize: false,
  });

  return (
    <div>
      <div ref={containerRef}>
        <button
          ref={(node) => {
            itemRefs.current.today = node;
          }}
          type="button"
        >
          Today
        </button>
      </div>
      <output data-testid="highlight-style">{JSON.stringify(style)}</output>
    </div>
  );
}

function TestMeasuredHighlightWithCustomSize() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<HighlightItemRefs<HTMLButtonElement>>({});
  const style = useMeasuredHighlight({
    activeKey: "today",
    containerRef,
    itemRefs: itemRefs as MutableRefObject<HighlightItemRefs<HTMLElement>>,
    observeResize: false,
    getTargetSize: (element) => {
      const label = element.querySelector("[data-label]") as HTMLElement | null;
      return label ? { width: element.offsetWidth + label.scrollWidth - label.offsetWidth } : undefined;
    },
  });

  return (
    <div>
      <div ref={containerRef}>
        <button
          ref={(node) => {
            itemRefs.current.today = node;
          }}
          type="button"
        >
          <span data-label>Today</span>
        </button>
      </div>
      <output data-testid="highlight-style">{JSON.stringify(style)}</output>
    </div>
  );
}

describe("useMeasuredHighlight", () => {
  beforeEach(() => {
    observedTargets.clear();
    resizeCallback = null;
  });

  it("remeasures the active item when observed layout changes", () => {
    vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(<TestMeasuredHighlight />);

    const today = screen.getByRole("button", { name: "Today 1" });
    const completed = screen.getByRole("button", { name: "Completed" });
    setBox(today, { left: 8, top: 4, width: 72, height: 36 });
    setBox(completed, { left: 88, top: 4, width: 112, height: 36 });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":72');
    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"translate3d(8px, 4px, 0)"');

    act(() => {
      screen.getByRole("button", { name: "Change text" }).click();
    });

    const updatedToday = screen.getByRole("button", { name: "Today 99" });
    setBox(updatedToday, { left: 8, top: 4, width: 92, height: 36 });
    setBox(completed, { left: 108, top: 4, width: 112, height: 36 });

    act(() => {
      resizeCallback?.([{ target: updatedToday }]);
    });

    expect(observedTargets.has(updatedToday)).toBe(true);
    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":92');
    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"translate3d(8px, 4px, 0)"');
    expect(rafSpy).toHaveBeenCalled();
  });

  it("clears the highlight when the rendered layout no longer contains the active item", () => {
    vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(<TestMeasuredHighlight />);

    const today = screen.getByRole("button", { name: "Today 1" });
    setBox(today, { left: 8, top: 4, width: 72, height: 36 });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":72');

    act(() => {
      screen.getByRole("button", { name: "Hide active" }).click();
    });

    expect(screen.getByTestId("highlight-style")).toHaveTextContent("null");
  });

  it("can avoid resize observation when the active item animates its own layout", () => {
    vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(<TestMeasuredHighlightWithoutResizeObservation />);

    const today = screen.getByRole("button", { name: "Today" });
    setBox(today, { left: 8, top: 4, width: 72, height: 36 });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(observedTargets.size).toBe(0);
    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":72');

    setBox(today, { left: 8, top: 4, width: 120, height: 36 });

    act(() => {
      resizeCallback?.([{ target: today }]);
    });

    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":72');
  });

  it("can measure a stable target size for animating active item content", () => {
    vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(<TestMeasuredHighlightWithCustomSize />);

    const today = screen.getByRole("button", { name: "Today" });
    const label = screen.getByText("Today");
    setBox(today, { left: 8, top: 4, width: 72, height: 36 });
    setBox(label, { left: 0, top: 0, width: 0, height: 16 });
    Object.defineProperty(label, "scrollWidth", { configurable: true, value: 44 });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("highlight-style")).toHaveTextContent('"width":116');
  });
});
