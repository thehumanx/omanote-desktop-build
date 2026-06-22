import { HashtagChip } from "./HashtagChip";

const HASHTAG_RE = /((?:^|\s)#[a-zA-Z]\w*)/g;

interface RichTextWithHashtagsProps {
  text: string;
  onHashtagClick?: (name: string) => void;
  className?: string;
}

/**
 * Renders a plain-text string with any #hashtag tokens replaced by colored
 * HashtagChip elements. Preserves whitespace before/after chips.
 */
export function RichTextWithHashtags({ text, onHashtagClick, className }: RichTextWithHashtagsProps) {
  const parts = text.split(HASHTAG_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const trimmed = part.trim();
        if (trimmed.startsWith("#") && trimmed.length > 1) {
          const name = trimmed.slice(1);
          const leadingSpace = part.startsWith(" ") || part.startsWith("\n") ? part[0] : "";
          return (
            <span key={i}>
              {leadingSpace}
              <HashtagChip
                name={name}
                onClick={onHashtagClick ? () => onHashtagClick(name) : undefined}
                className="mx-0.5 align-middle"
              />
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
