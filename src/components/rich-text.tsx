import type { ReactNode, RefObject } from "react";
import { createMarkdownLink, normalizeLinkUrl } from "@omanote/shared";
import { cn } from "./ui";
import { HashtagChip } from "./HashtagChip";
import { MentionChip } from "./MentionChip";
import { useLinkCopyPopover } from "./LinkCopyPopover";

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
  const { anchorRef, handlers, popover } = useLinkCopyPopover(token.href);

  return (
      <span
      ref={anchorRef as RefObject<HTMLSpanElement>}
      className="group/link relative inline-flex min-w-0 max-w-full items-center"
      {...handlers}
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
  highlightQuery?: string | null,
): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^)]+\)|(https?:\/\/|mailto:|tel:)[^\s<]+|`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|(?:^|\s)#[a-zA-Z]\w*|(?:^|\s)@[^\s@]+@[^\s@]+\.[^\s@]+)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(
        <span key={`text-${baseOffset + lastIndex}`} data-rich-text-source-start={baseOffset + lastIndex}>
          {highlightText(text.slice(lastIndex, index), highlightQuery, `h-${baseOffset + lastIndex}`)}
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
    } else if (
      (() => {
        const atIndex = token.indexOf("@");
        return atIndex !== -1 && (atIndex === 0 || /\s/.test(token[atIndex - 1]));
      })()
    ) {
      const atIndex = token.indexOf("@");
      const leadingWhitespace = token.slice(0, atIndex);
      const email = token.slice(atIndex + 1).toLowerCase();
      if (leadingWhitespace) {
        nodes.push(
          <span key={`text-${baseOffset + index}`} data-rich-text-source-start={baseOffset + index}>
            {leadingWhitespace}
          </span>,
        );
      }
      nodes.push(<MentionChip key={`${index}-${token}`} email={email} className="mx-0.5 align-middle" />);
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
            {highlightText(token, highlightQuery, `h-${baseOffset + index}`)}
          </span>,
        );
      }
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 1} className="rounded bg-app-surface-muted px-1.5 py-0.5 font-mono text-[0.92em] text-app-ink">
          {highlightText(token.slice(1, -1), highlightQuery, `h-${baseOffset + index}`)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 2}>{highlightText(token.slice(2, -2), highlightQuery, `h-${baseOffset + index}`)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${index}-${token}`} data-rich-text-source-start={baseOffset + index + 1}>{highlightText(token.slice(1, -1), highlightQuery, `h-${baseOffset + index}`)}</em>);
    } else {
      nodes.push(
        <span key={`text-${baseOffset + index}`} data-rich-text-source-start={baseOffset + index}>
          {highlightText(token, highlightQuery, `h-${baseOffset + index}`)}
        </span>,
      );
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`text-${baseOffset + lastIndex}`} data-rich-text-source-start={baseOffset + lastIndex}>
        {highlightText(text.slice(lastIndex), highlightQuery, `h-${baseOffset + lastIndex}`)}
      </span>,
    );
  }

  return nodes;
}

/** Wraps case-insensitive matches of `query` in `text` with a light-blue <mark>. Returns the plain string when there's nothing to highlight, so callers can keep using it wherever a plain string child worked before. */
export function highlightText(text: string, query: string | null | undefined, keyBase: string): ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery || !lowerText.includes(lowerQuery)) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, cursor);
  while (matchIndex !== -1) {
    if (matchIndex > cursor) nodes.push(text.slice(cursor, matchIndex));
    nodes.push(
      <mark key={`${keyBase}-${matchIndex}`} className="rounded bg-info-line text-inherit">
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>,
    );
    cursor = matchIndex + query.length;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

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
      className={cn(depth === 0 ? "m-0" : "mb-0 mt-1", "pl-5", markerClass)}
    >
      {list.items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "list-item text-zinc-400 marker:text-zinc-400",
            depth === 0 ? "mb-2 mt-0" : "m-0",
            paragraphClassName,
          )}
        >
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
  highlightQuery,
}: {
  value: string;
  className?: string;
  paragraphClassName?: string;
  onLinkEdit?: (nextValue: string) => void;
  onHashtagClick?: (name: string) => void;
  /** When set, case-insensitive matches of this string are wrapped in a light-blue <mark>. */
  highlightQuery?: string | null;
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

      const content = inlineNodes(text, offset + displayLine.indexOf(text), value, onLinkEdit, onHashtagClick, highlightQuery);
      listStack[listStack.length - 1].items.push({ key, content, children: null });
      offset += line.length + 1;
      return;
    }

    flushList();

    nodes.push(
      <p key={key} className={cn("whitespace-pre-wrap break-words", paragraphClassName)}>
        {inlineNodes(displayLine, offset, value, onLinkEdit, onHashtagClick, highlightQuery)}
      </p>,
    );
    offset += line.length + 1;
  });

  flushList();

  return <div className={cn("omanote-rich-text", className)}>{nodes}</div>;
}
