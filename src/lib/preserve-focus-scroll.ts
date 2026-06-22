function getScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll)/.test(overflowY)) ancestors.push(node);
    node = node.parentElement;
  }
  return ancestors;
}

export function captureScrollSnapshot(target: HTMLElement) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const scrollableAncestors = getScrollableAncestors(target).map((node) => ({
    node,
    scrollLeft: node.scrollLeft,
    scrollTop: node.scrollTop,
  }));

  const restoreScrollPosition = () => {
    const isJsdom = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    if (!isJsdom) {
      window.scrollTo(scrollX, scrollY);
    }
    for (const { node, scrollLeft, scrollTop } of scrollableAncestors) {
      node.scrollLeft = scrollLeft;
      node.scrollTop = scrollTop;
    }
  };

  return restoreScrollPosition;
}

export function restoreScrollForNextFrames(restoreScrollPosition: () => void, durationMs = 180) {
  restoreScrollPosition();

  let stopped = false;
  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    if (stopped) return;
    restoreScrollPosition();
    raf2 = requestAnimationFrame(() => {
      if (!stopped) restoreScrollPosition();
    });
  });
  const timer = window.setTimeout(restoreScrollPosition, 0);
  const interval = window.setInterval(restoreScrollPosition, 16);
  const stopTimer = window.setTimeout(() => {
    stopped = true;
    window.clearInterval(interval);
  }, durationMs);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    window.clearTimeout(timer);
    window.clearTimeout(stopTimer);
    window.clearInterval(interval);
  };
}

export function focusWithoutScrolling(
  target: HTMLElement,
  focus: () => void,
) {
  const restoreScrollPosition = captureScrollSnapshot(target);
  focus();
  return restoreScrollForNextFrames(restoreScrollPosition);
}
