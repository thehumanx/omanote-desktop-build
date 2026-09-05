import { useCallback, useEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ImageOff, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@clerk/react";
import { deletePageImage, fetchPageImageObjectUrl } from "../../lib/page-images";
import { useEncryption } from "../../contexts/EncryptionContext";

/**
 * An image inside a canvas.
 *
 * The node stores the R2 object key, not a URL. What is stored there is
 * ciphertext, so rendering means fetch → decrypt → blob URL; the key could
 * never have gone straight into `src`, with or without auth.
 */

// Matches the page column's max-w-[720px] (PageScreen) — resizing past it
// would just get clipped by the column, so there is no point allowing it.
const MIN_WIDTH = 120;
const MAX_WIDTH = 720;

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function PageImageView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const objectKey = (node.attrs.objectKey as string | null) ?? null;
  const alt = (node.attrs.alt as string | null) ?? "";
  const width = (node.attrs.width as number | null) ?? null;
  const bytes = (node.attrs.bytes as number | null) ?? null;
  const { getToken } = useAuth();
  const { encryptBinary, decryptBinary, isLocked } = useEncryption();
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    // Nothing to render until the content key is in memory — the bytes are
    // useless without it, and attempting the fetch would just burn a request.
    if (!objectKey || isLocked) return;
    let cancelled = false;
    let created: string | null = null;

    void (async () => {
      try {
        const url = await fetchPageImageObjectUrl(
          objectKey,
          () => getToken({ template: "convex" }),
          { encryptBinary, decryptBinary },
        );
        created = url;
        // Revoke immediately if the node unmounted while the fetch was in
        // flight — otherwise the blob leaks for the life of the document.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setState({ url, failed: false });
      } catch {
        if (!cancelled) setState({ url: null, failed: true });
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [objectKey, isLocked, getToken, encryptBinary, decryptBinary]);

  const handleDelete = useCallback(() => {
    // Best-effort: the block disappearing is what matters to the user right
    // now. A failed delete just leaves an orphaned object in R2, which costs
    // storage but nothing worse — there is nothing useful to retry against
    // once the block is already gone from the document.
    if (objectKey) void deletePageImage(objectKey, () => getToken({ template: "convex" })).catch(() => {});
    deleteNode();
  }, [objectKey, getToken, deleteNode]);

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startWidth = imageRef.current?.getBoundingClientRect().width ?? width ?? MAX_WIDTH;
      dragRef.current = { startX: event.clientX, startWidth };

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = moveEvent.clientX - dragRef.current.startX;
        const next = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta)));
        updateAttributes({ width: next });
      };
      const handleUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [updateAttributes, width],
  );

  return (
    <NodeViewWrapper className="my-3" contentEditable={false} data-drag-handle>
      {/* inline-block: with no explicit width (not yet resized) the box
          shrink-wraps to the image's own rendered size rather than stretching
          to the column — a block div would fill 100% regardless of content,
          which combined with a stretched <img> was producing letterboxing
          that read as "centered" rather than left-aligned. Once resized, the
          explicit width below takes over and the image fills it exactly. */}
      <div
        className="group/image relative inline-block max-w-full"
        style={width ? { width: `${width}px` } : undefined}
      >
        {state.url ? (
          <>
            <img
              ref={imageRef}
              src={state.url}
              alt={alt}
              className={
                width
                  ? "block h-auto w-full rounded-2xl border border-app-line"
                  : "block max-h-[520px] max-w-full rounded-2xl border border-app-line"
              }
            />
            <button
              type="button"
              aria-label="delete image"
              draggable={false}
              onClick={handleDelete}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-app-surface/90 text-app-ink-muted opacity-0 shadow-soft transition hover:bg-app-surface hover:text-danger-ink group-hover/image:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {/* Bottom-right resize handle — drag horizontally to set a fixed
                width, clamped so the image never gets useless or overflows
                the column. draggable=false so it doesn't trigger the node's
                own block-reorder drag (the node is draggable: true). */}
            <div
              role="presentation"
              draggable={false}
              onPointerDown={startResize}
              className="absolute bottom-2 right-2 z-10 h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-app-surface bg-app-ink-faint opacity-0 transition group-hover/image:opacity-100"
            />
            {/* Caption, doubling as the <img> alt text — editable in place
                rather than through a separate dialog. Size sits at the far
                right of the same row rather than a hover tooltip. */}
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                value={alt}
                onChange={(event) => updateAttributes({ alt: event.target.value })}
                placeholder="Add a caption…"
                className="block min-w-0 flex-1 border-none bg-transparent p-0 text-xs text-app-ink-faint outline-none placeholder:text-app-ink-faint focus:text-app-ink-muted"
              />
              {bytes ? (
                <span className="shrink-0 text-xs text-app-ink-faint">{formatKb(bytes)}</span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-40 w-full items-center justify-center gap-2 rounded-2xl border border-app-line bg-app-surface-muted text-sm text-app-ink-faint">
            {state.failed ? (
              <>
                <ImageOff className="h-4 w-4" />
                <span>This image couldn’t be loaded</span>
              </>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const PageImageNode = Node.create({
  name: "pageImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      objectKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-object-key"),
        renderHTML: (attributes) =>
          attributes.objectKey ? { "data-object-key": attributes.objectKey } : {},
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-width");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes) => (attributes.width ? { "data-width": String(attributes.width) } : {}),
      },
      // Plaintext (post-compression) byte size, set once at upload time —
      // shown as a tooltip on hover, see formatKb.
      bytes: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-bytes");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes) => (attributes.bytes ? { "data-bytes": String(attributes.bytes) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageImageView, {
      // Same reasoning as PageBookmarkNode: without this, ProseMirror's own
      // atom-node click handling intercepts the resize handle's mousedown
      // before our pointer listener gets a clean drag.
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return (
          !!target?.closest("button") ||
          !!target?.closest("input") ||
          (event.type === "pointerdown" && !!target?.closest("[role=presentation]"))
        );
      },
    });
  },
});
