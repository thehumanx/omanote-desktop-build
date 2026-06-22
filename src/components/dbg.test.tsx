import { describe, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { HashtagDecorationExtension, MarkdownNoIndentCodeExtension, BulletAfterBreakExtension } from "../lib/tiptap-note";

describe("dbg", () => {
  it("probe each plugin", () => {
    const e = new Editor({
      extensions: [
        StarterKit.configure({ heading: false, blockquote: false, horizontalRule: false, codeBlock: false }),
        Link.configure({ openOnClick: false }),
        Markdown.configure({ html: false, breaks: true }),
        HashtagDecorationExtension, MarkdownNoIndentCodeExtension, BulletAfterBreakExtension,
      ],
      content: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "line1" }, { type: "hardBreak" }, { type: "text", text: "-" } ] }] },
    });
    e.commands.focus("end");
    const view = e.view;
    const pos = view.state.selection.from;
    const plugins = view.state.plugins;
    plugins.forEach((p: any, i: number) => {
      const h = p.props?.handleTextInput;
      if (!h) return;
      try {
        const r = h.call(p.props, view, pos, pos, " ");
        console.log("DBG plugin", i, "isInputRules=", !!p.spec?.isInputRules, "=>", r);
      } catch (err: any) {
        console.log("DBG plugin", i, "ERR", err.message);
      }
    });
    console.log("DBG final html=", e.getHTML());
    e.destroy();
  });
});
