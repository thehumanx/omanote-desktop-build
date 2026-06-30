import { useEffect } from "react";
import { SeoHead } from "../seo/SeoHead";
import { useMutation, useQuery } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { getShareViewerToken } from "../lib/share-viewer-token";
import { RichTextPreview } from "../components/rich-text";
import { extractAllPreviewableUrls } from "../lib/attachment-link-preview";
import { UrlLinkPreview } from "../components/AttachmentLinkPreview";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";

type PublicNote = {
  id: string;
  title?: string;
  body: string;
  tags: string[];
};


function PublicNoteEntry({ note }: { note: PublicNote }) {
  const normalizedBody = normalizeLegacyNoteBodyForTiptap(note.body);
  return (
    <div>
      <div className="text-sm leading-relaxed text-app-ink-muted">
        <RichTextPreview
          value={normalizedBody}
          paragraphClassName="text-sm leading-relaxed text-app-ink-muted break-words"
        />
      </div>
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-app-surface-muted px-2 py-0.5 text-xs text-app-ink-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderAttachedLinks({ notes }: { notes: PublicNote[] }) {
  const linkUrls = extractAllPreviewableUrls(...notes.flatMap((n) => [n.title, normalizeLegacyNoteBodyForTiptap(n.body)]));
  if (linkUrls.length === 0) return null;

  return (
    <div className="mt-2 rounded-2xl border border-app-line bg-app-surface px-6 py-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-app-ink-faint">
        Attached links
      </p>
      <div className="flex flex-col gap-2">
        {linkUrls.map((url) => (
          <UrlLinkPreview key={url} url={url} />
        ))}
      </div>
    </div>
  );
}

function formatSharedDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function OwnerAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!imageUrl) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-app-line text-[10px] font-bold uppercase text-app-ink-muted">
        {initial}
      </div>
    );
  }

  return (
    <div className="relative h-6 w-6 overflow-hidden rounded-full bg-app-line">
      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase text-app-ink-muted">
        {initial}
      </div>
      <img
        src={imageUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full rounded-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

export function SharedNoteFolderPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const data = useQuery(api.sharedNoteFolders.getPublicShare, {
    shareCode: shareCode ?? "",
  });
  const recordView = useMutation(api.sharedNoteFolders.recordShareView);
  const unshare = useMutation(api.sharedNoteFolders.unshareFromPublicPage);

  useEffect(() => {
    if (!shareCode || data === undefined || data === null) return;
    void recordView({ shareCode, viewerToken: getShareViewerToken() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, data !== null && data !== undefined]);

  if (data === undefined) {
    return (
      <>
        <SeoHead title="omanote | Shared notes" noIndex />
        <div className="public-page flex min-h-screen items-center justify-center bg-app-canvas">
          <div className="h-8 w-8 animate-pulse rounded-full bg-app-line" />
        </div>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <SeoHead title="omanote | Shared notes" noIndex />
        <div className="public-page flex min-h-screen flex-col items-center justify-center gap-4 bg-app-canvas px-4">
        <Link to="/" className="flex items-center gap-2 text-app-ink">
          <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
        </Link>
        <p className="text-sm text-app-ink-muted">This link is no longer available.</p>
      </div>
    </>
    );
  }

  return (
    <>
      <SeoHead
        title={`omanote | ${data.folderName} by ${data.ownerName.split(" ")[0]}`}
        description={`${data.folderName} — a shared note folder by ${data.ownerName} on omanote.`}
        noIndex
      />
      <div className="public-page min-h-screen bg-app-canvas">
      <header className="sticky top-0 z-10 border-b border-app-line bg-app-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center transition hover:opacity-70">
            <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
          </Link>
          {data.isOwner && (
            <button
              type="button"
              onClick={async () => {
                await unshare({ shareCode: data.shareCode });
              }}
              className="rounded-lg border border-danger-line bg-danger-surface px-3 py-1.5 text-xs font-medium text-danger-ink transition hover:bg-danger-surface"
            >
              Unshare
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-app-ink">
            {data.folderIcon && <span className="mr-2">{data.folderIcon}</span>}
            {data.folderName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <OwnerAvatar name={data.ownerName} imageUrl={data.ownerImageUrl} />
              <span className="text-sm text-app-ink-muted">{data.ownerName}</span>
            </div>
            <span className="text-app-ink-faint">·</span>
            <span className="text-sm text-app-ink-faint">
              Updated {formatSharedDate(data.snapshotUpdatedAt ?? data.createdAt)}
            </span>
            <span className="text-app-ink-faint">·</span>
            <span className="text-sm text-app-ink-faint">
              {data.viewCount === 0
                ? "No views yet"
                : data.viewCount === 1
                  ? "1 view"
                  : `${data.viewCount} views`}
            </span>
          </div>
        </div>

        {data.notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-app-line bg-app-surface py-16 text-center">
            <p className="text-sm font-medium text-app-ink-muted">No notes in this folder yet.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-app-line bg-app-surface px-6 py-6 flex flex-col gap-4">
              {data.notes.map((note) => (
                <PublicNoteEntry key={note.id} note={note} />
              ))}
            </div>
            <FolderAttachedLinks notes={data.notes} />
          </>
        )}
      </main>
    </div>
    </>
  );
}
