import { Bold, Check, Code2, Copy, Italic, List, ListOrdered } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createMarkdownLink, normalizeLinkUrl } from "@omanote/shared";
import { cn } from "./ui";
import { HashtagChip } from "./HashtagChip";

export type RichTextFormat = "bold" | "italic" | "bullet" | "ordered" | "code";

type TransformResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function selectedLineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextLineBreak = value.indexOf("\n", end);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  return { lineStart, lineEnd };
}

function transformLines(lines: string[], format: Exclude<RichTextFormat, "bold" | "italic" | "code">) {
  if (format === "bullet") {
    return lines.map((line) => (line.startsWith("- ") ? line : `- ${line}`));
  }

  if (format === "ordered") {
    return lines.map((line, index) => {
      if (/^\d+\.\s/.test(line)) return line;
      return `${index + 1}. ${line}`;
    });
  }

  return lines;
}

export function applyRichTextFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: RichTextFormat,
): TransformResult {
  if (format === "bold" || format === "italic" || format === "code") {
    const wrappers: Record<typeof format, { before: string; after: string }> = {
      bold: { before: "**", after: "**" },
      italic: { before: "*", after: "*" },
      code: { before: "`", after: "`" },
    } as const;
    const { before, after } = wrappers[format];
    const selected = value.slice(selectionStart, selectionEnd);
    const nextValue = `${value.slice(0, selectionStart)}${before}${selected || ""}${after}${value.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + before.length;
    const nextSelectionEnd = nextSelectionStart + selected.length;
    return {
      value: nextValue,
      selectionStart: nextSelectionStart,
      selectionEnd: nextSelectionEnd,
    };
  }

  const { lineStart, lineEnd } = selectedLineRange(value, selectionStart, selectionEnd);
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split("\n");
  const nextLines = transformLines(lines, format);
  const nextValue = `${value.slice(0, lineStart)}${nextLines.join("\n")}${value.slice(lineEnd)}`;
  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextLines.join("\n").length,
  };
}

export function applyRichTextFormatToTextarea(
  textarea: HTMLTextAreaElement,
  format: RichTextFormat,
  onValueChange: (nextValue: string) => void,
) {
  const result = applyRichTextFormat(
    textarea.value,
    textarea.selectionStart ?? 0,
    textarea.selectionEnd ?? textarea.value.length,
    format,
  );
  onValueChange(result.value);
  window.requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
}

type LinkTokenInfo = {
  raw: string;
  href: string;
  displayText: string;
  start: number;
  end: number;
  isMarkdown: boolean;
};

function parseLinkToken(token: string): LinkTokenInfo | null {
  if (token.startsWith("[")) {
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!linkMatch) return null;
    const href = normalizeLinkUrl(linkMatch[2]);
    if (!href) return null;
    return {
      raw: token,
      href,
      displayText: linkMatch[1],
      start: 0,
      end: token.length,
      isMarkdown: true,
    };
  }

  if (token.startsWith("http") || token.startsWith("mailto:") || token.startsWith("tel:")) {
    const href = normalizeLinkUrl(token);
    if (!href) return null;
    return {
      raw: token,
      href,
      displayText: token,
      start: 0,
      end: token.length,
      isMarkdown: false,
    };
  }

  return null;
}

function LinkToken({
  value,
  token,
  start,
  onEdit,
}: {
  value: string;
  token: LinkTokenInfo;
  start: number;
  onEdit?: (nextValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hasPosition, setHasPosition] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; placement: "above" | "below" }>({
    top: 0,
    left: 0,
    placement: "below",
  });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const tooltipUrl = token.href.length > 24 ? `${token.href.slice(0, 24)}…` : token.href;

  const cancelClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const copyTimeoutRef = useRef<number | null>(null);

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 80);
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;

    const updatePosition = () => {
      const anchor = spanRef.current;
      const popover = popoverRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 288;
      const padding = 12;
      const left = Math.min(Math.max(padding, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - padding);
      const popoverHeight = popover?.offsetHeight ?? 40;
      const top = Math.max(8, rect.top - popoverHeight - 6);
      setPopoverPosition({ top, left, placement: "above" });
      setHasPosition(true);
    };

    setHasPosition(false);
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, token.href]);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setIsMounted(false), 160);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(token.href);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 900);
    } catch {
      // ignore clipboard failures silently
    }
  };

  const visible = open;
  const popover = isMounted && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popoverRef}
          data-rich-text-popover="true"
          className={[
            "fixed z-app-extension-root max-w-[320px] rounded-xl border border-app-line bg-app-surface px-3 py-2 shadow-soft transition-opacity duration-150 ease-out",
            visible ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          style={{ top: popoverPosition.top, left: popoverPosition.left, visibility: hasPosition ? "visible" : "hidden" }}
          onMouseEnter={() => {
            cancelClose();
          }}
          onMouseLeave={() => {
            scheduleClose();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-app-ink-muted" title={token.href}>
              {tooltipUrl}
            </p>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy link"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void copyLink();
              }}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-xs font-medium text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success-ink animate-[omanote-copy-check_220ms_ease-out]" />
                  <span className="text-success-ink">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
      <span
      ref={spanRef}
      className="group/link relative inline-flex min-w-0 max-w-full items-center"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={(event) => {
        if (popoverRef.current?.contains(event.relatedTarget as Node | null)) return;
        scheduleClose();
      }}
    >
      <a
        href={token.href}
        target={token.href.startsWith("http://") || token.href.startsWith("https://") ? "_blank" : undefined}
        rel={token.href.startsWith("http://") || token.href.startsWith("https://") ? "noreferrer" : undefined}
        className="min-w-0 break-words rounded-sm font-bold text-app-ink underline decoration-2 decoration-zinc-300 underline-offset-2 transition hover:decoration-zinc-900"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {token.displayText}
      </a>
      {popover}
    </span>
  );
}

function inlineNodes(
  text: string,
  baseOffset: number,
  sourceValue: string,
  onLinkEdit?: (nextValue: string) => void,
  onHashtagClick?: (name: string) => void,
): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^)]+\)|(https?:\/\/|mailto:|tel:)[^\s<]+|`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|(?:^|\s)#[a-zA-Z]\w*)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(
        <span key={`text-${baseOffset + lastIndex}`} data-rich-text-source-start={baseOffset + lastIndex}>
          {text.slice(lastIndex, index)}
        </span>,
      );
    }

    const hashIndex = token.indexOf("#");
    if (hashIndex !== -1 && (hashIndex === 0 || /\s/.test(token[hashIndex - 1]))) {
      const leadingWhitespace = token.slice(0, hashIndex);
      const name = token.slice(hashIndex + 1);
      if (leadingWhitespace) {
        nodes.push(
          <span key={`text-${baseOffset + index}`} data-rich-text-source-start={baseOffset + index}>
            {leadingWhitespace}
          </span>,
        );
      }
      nodes.push(
        <HashtagChip
          key={`${index}-${token}`}
          name={name}
          onClick={onHashtagClick ? () => onHashtagClick(name) : undefined}
          withTooltip={!onHashtagClick}
          className="mx-0.5 align-middle"
        />,
      );
    } else if (token.startsWith("[") || token.startsWith("http") || token.startsWith("mailto:") || token.startsWith("tel:")) {
      const linkToken = parseLinkToken(token);
      if (linkToken) {
        nodes.push(
          <LinkToken
            key={`${index}-${token}`}
            value={sourceValue}
            token={linkToken}
            start={baseOffset + index}
            onEdit={onLinkEdit}
          />,
        );
      } else {
        nodes.push(
          <span key={`text-${baseOffset + index}`} data-rich-text-source-start={baseOffset + index}>
            {token}
          </span>,
        );
      }
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 1} className="rounded bg-app-surface-muted px-1.5 py-0.5 font-mono text-[0.92em] text-app-ink">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 2}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 1}>{token.slice(1, -1)}</em>);
    } else {
      nodes.push(
        <span key={`text-${baseOffset + index}`} data-rich-text-source-start={baseOffset + index}>
          {token}
        </span>,
      );
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`text-${baseOffset + lastIndex}`} data-rich-text-source-start={baseOffset + lastIndex}>
        {text.slice(lastIndex)}
      </span>,
    );
  }

  return nodes;
}

const BULLET_MARKER_CLASSES = ["list-disc", "list-[circle]", "list-[square]"];
const ORDERED_MARKER_CLASSES = ["list-decimal", "list-[lower-alpha]", "list-[lower-roman]"];

type ListItemAcc = {
  key: string;
  content: ReactNode;
  children: ListAcc | null;
};

type ListAcc = {
  id: number;
  type: "bullet" | "ordered";
  indent: number;
  start: number;
  items: ListItemAcc[];
};

function renderListAcc(list: ListAcc, depth: number, paragraphClassName?: string): ReactNode {
  const Tag = list.type === "bullet" ? "ul" : "ol";
  const markerClass =
    list.type === "bullet"
      ? BULLET_MARKER_CLASSES[depth % BULLET_MARKER_CLASSES.length]
      : ORDERED_MARKER_CLASSES[depth % ORDERED_MARKER_CLASSES.length];

  return (
    <Tag
      key={`list-${list.id}`}
      start={list.type === "ordered" ? list.start : undefined}
      className={cn("m-0 pl-5", markerClass)}
    >
      {list.items.map((item) => (
        <li key={item.key} className={cn("m-0 list-item text-zinc-400 marker:text-zinc-400", paragraphClassName)}>
          <span className="text-app-ink">{item.content}</span>
          {item.children ? renderListAcc(item.children, depth + 1, paragraphClassName) : null}
        </li>
      ))}
    </Tag>
  );
}

export function RichTextPreview({
  value,
  className,
  paragraphClassName,
  onLinkEdit,
  onHashtagClick,
}: {
  value: string;
  className?: string;
  paragraphClassName?: string;
  onLinkEdit?: (nextValue: string) => void;
  onHashtagClick?: (name: string) => void;
}) {
  const lines = value.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listStack: ListAcc[] = [];
  let listIdCounter = 0;
  let offset = 0;

  const flushList = () => {
    if (!listStack.length) return;
    while (listStack.length > 1) {
      const child = listStack.pop() as ListAcc;
      const parent = listStack[listStack.length - 1];
      parent.items[parent.items.length - 1].children = child;
    }
    const root = listStack.pop() as ListAcc;
    nodes.push(renderListAcc(root, 0, paragraphClassName));
    listStack = [];
  };

  lines.forEach((line, index) => {
    const displayLine = line.endsWith("\\") ? line.slice(0, -1) : line;
    const key = `${index}-${line}`;
    if (!displayLine.trim()) {
      flushList();
      nodes.push(<div key={key} className="h-6" />);
      offset += line.length + 1;
      return;
    }

    const bulletMatch = displayLine.match(/^(\s*)[-*+]\s+(.+)$/);
    const orderedMatch = !bulletMatch ? displayLine.match(/^(\s*)(\d+)\.\s+(.+)$/) : null;

    if (bulletMatch || orderedMatch) {
      const type: ListAcc["type"] = bulletMatch ? "bullet" : "ordered";
      const indent = (bulletMatch ?? orderedMatch)![1].length;
      const text = bulletMatch ? bulletMatch[2] : orderedMatch![3];
      const start = orderedMatch ? Number.parseInt(orderedMatch[2], 10) || 1 : 1;

      while (
        listStack.length &&
        (indent < listStack[listStack.length - 1].indent ||
          (indent === listStack[listStack.length - 1].indent && listStack[listStack.length - 1].type !== type))
      ) {
        const child = listStack.pop() as ListAcc;
        if (listStack.length) {
          const parent = listStack[listStack.length - 1];
          parent.items[parent.items.length - 1].children = child;
        } else {
          nodes.push(renderListAcc(child, 0, paragraphClassName));
        }
      }

      if (!listStack.length || indent > listStack[listStack.length - 1].indent) {
        listStack.push({ id: listIdCounter++, type, indent, start, items: [] });
      }

      const content = inlineNodes(text, offset + displayLine.indexOf(text), value, onLinkEdit, onHashtagClick);
      listStack[listStack.length - 1].items.push({ key, content, children: null });
      offset += line.length + 1;
      return;
    }

    flushList();

    nodes.push(
      <p key={key} className={cn("whitespace-pre-wrap break-words", paragraphClassName)}>
        {inlineNodes(displayLine, offset, value, onLinkEdit, onHashtagClick)}
      </p>,
    );
    offset += line.length + 1;
  });

  flushList();

  return <div className={cn("omanote-rich-text", className)}>{nodes}</div>;
}

export function RichTextToolbar({
  textareaRef,
  onValueChange,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onValueChange: (nextValue: string) => void;
  className?: string;
}) {
  const buttons: Array<{ format: RichTextFormat; label: string; icon: ReactNode }> = [
    { format: "bold", label: "Bold", icon: <Bold className="h-3.5 w-3.5" /> },
    { format: "italic", label: "Italic", icon: <Italic className="h-3.5 w-3.5" /> },
    { format: "bullet", label: "Bullet list", icon: <List className="h-3.5 w-3.5" /> },
    { format: "ordered", label: "Numbered list", icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { format: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {buttons.map((button) => (
        <div key={button.format}>
          <button
            type="button"
            aria-label={button.label}
            className="flex h-8 w-8 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            onMouseDown={(event) => {
              event.preventDefault();
              const textarea = textareaRef.current;
              if (!textarea) return;
              applyRichTextFormatToTextarea(textarea, button.format, onValueChange);
            }}
          >
            {button.icon}
          </button>
        </div>
      ))}
    </div>
  );
}
