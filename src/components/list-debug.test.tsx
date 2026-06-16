import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { HashtagDecorationExtension, MarkdownNoIndentCodeExtension, BulletAfterBreakExtension } from "../lib/tiptap-note";

function makeEditor(content: object | string) {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, horizontalRule: false, codeBlock: false }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({ html: false, breaks: true }),
      HashtagDecorationExtension,
      MarkdownNoIndentCodeExtension,
      BulletAfterBreakExtension,
    ],
    content,
  });
}

function typeSpace(e: Editor) {
  const view = e.view;
  const pos = view.state.selection.from;
  view.someProp("handleTextInput", (f) => f(view, pos, pos, " ", () => view.state.tr.insertText(" ", pos, pos)));
}

describe("bullet input rules", () => {
  it("typing '- ' at paragraph start creates a bulletList", () => {
    const e = makeEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "-" }] }],
    });
    e.commands.focus("end");
    typeSpace(e);
    expect(e.getHTML()).toContain("<ul");
    e.destroy();
  });

  it("typing '- ' after a hard break creates a bulletList", () => {
    const e = makeEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "line1" },
            { type: "hardBreak" },
            { type: "text", text: "-" },
          ],
        },
      ],
    });
    e.commands.focus("end");
    typeSpace(e);
    const html = e.getHTML();
    console.log("AFTER-BREAK html =>", html);
    expect(html).toContain("<ul");
    expect(html).toContain("line1");
    e.destroy();
  });
});
