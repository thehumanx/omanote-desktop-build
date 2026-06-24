import { createPortal } from "react-dom";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hashtagColor } from "../lib/hashtags";
import { useOptionalApp } from "../app/AppProvider";

/** Set to true in contexts where the "View mindmap" tooltip should be hidden (e.g. already on Explore). */
export const SuppressHashtagTooltipCtx = createContext(false);

interface HashtagChipProps {
  name: string;
  onClick?: () => void;
  /** When true, hovering shows a clickable "View mindmap" tooltip action. */
  withTooltip?: boolean;
  className?: string;
}

export function HashtagChip({ name, onClick, withTooltip = false, className }: HashtagChipProps) {
  const color = hashtagColor(name);
  const navigate = useNavigate();
  const app = useOptionalApp();
  const dispatch = app?.dispatch;
  const suppressTooltip = useContext(SuppressHashtagTooltipCtx);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  const cancelTooltipClose = () => {
    if (closeTooltipTimeoutRef.current !== null) {
      window.clearTimeout(closeTooltipTimeoutRef.current);
      closeTooltipTimeoutRef.current = null;
    }
  };

  const scheduleTooltipClose = () => {
    cancelTooltipClose();
    closeTooltipTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      closeTooltipTimeoutRef.current = null;
    }, 180);
  };

  const openTooltip = () => {
    cancelTooltipClose();
    setShowTooltip(true);
  };

  useEffect(() => {
    return () => {
      cancelTooltipClose();
    };
  }, []);

  useLayoutEffect(() => {
    if (!showTooltip) {
      setTooltipPos(null);
      return;
    }

    const update = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      if (!anchorRect) return;

      const margin = 8;
      const offset = 4;
      const topChromeRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-top-chrome-height");
      const topChromeHeight = Number.parseFloat(topChromeRaw) || 0;
      const topBoundary = Math.max(margin, topChromeHeight + margin);
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      const tooltipWidth = tooltipRect?.width ?? 120;
      const tooltipHeight = tooltipRect?.height ?? 44;
      const availableAbove = anchorRect.top - topBoundary;
      const availableBelow = window.innerHeight - anchorRect.bottom - margin;
      const placement = tooltipHeight > availableAbove && availableBelow > availableAbove ? "below" : "above";
      const preferredTop = placement === "above"
        ? anchorRect.top - tooltipHeight - offset
        : anchorRect.bottom + offset;
      const top = Math.min(
        Math.max(topBoundary, preferredTop),
        Math.max(topBoundary, window.innerHeight - tooltipHeight - margin),
      );
      const preferredLeft = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
      const left = Math.min(
        Math.max(margin, preferredLeft),
        Math.max(margin, window.innerWidth - tooltipWidth - margin),
      );
      setTooltipPos({ top, left, placement });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showTooltip]);

  const base = [
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-none",
    color.bg,
    color.darkBg,
    color.text,
    color.darkText,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer transition-opacity hover:opacity-75`}
      >
        #{name}
      </button>
    );
  }

  if (withTooltip && dispatch && !suppressTooltip) {
    const openMindMapForHashtag = () => {
      const nameLower = name.toLowerCase();
      dispatch({ type: "ui/set-search-query", query: "" });
      navigate("/explore");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("omanote:explore-focus-hashtag", {
            detail: { nameLower },
          }),
        );
      });
      setShowTooltip(false);
    };

    return (
      <span
        ref={anchorRef}
        className="inline-flex items-center"
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleTooltipClose}
      >
        <span className={base}>#{name}</span>
        {showTooltip && tooltipPos && typeof document !== "undefined"
          ? createPortal(
              <span
                ref={tooltipRef}
                className="fixed z-app-tooltip whitespace-nowrap rounded-lg bg-action-primary px-1 py-1 text-xs font-medium text-action-primary-ink shadow-lg"
                style={{ top: tooltipPos.top, left: tooltipPos.left }}
                onMouseEnter={openTooltip}
                onMouseLeave={scheduleTooltipClose}
              >
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-xs font-medium text-action-primary-ink transition hover:bg-action-primary-ink/15 focus:outline-none focus:ring-2 focus:ring-action-primary-ink/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMindMapForHashtag();
                  }}
                >
                  View mindmap
                </button>
                <span
                  className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-action-primary"
                  style={tooltipPos.placement === "above" ? { bottom: -3 } : { top: -3 }}
                />
              </span>,
              document.body,
            )
          : null}
      </span>
    );
  }

  return <span className={base}>#{name}</span>;
}
