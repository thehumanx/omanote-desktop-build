import MarkdownIt from "markdown-it";

/**
 * The same markdown-it the note editor already ships (via tiptap-markdown),
 * rather than a second engine (react-markdown + remark-gfm) for this one
 * screen. Tables and strikethrough are on by default. `html: false` escapes
 * any raw HTML: the guide is our own bundled copy, but there's no reason for
 * it to be able to inject markup.
 */
const guideMarkdown = new MarkdownIt({ html: false, linkify: true });

/** A guide topic's markdown as HTML, for the guide screen. */
export function renderGuideMarkdown(markdown: string): string {
  return guideMarkdown.render(markdown);
}
