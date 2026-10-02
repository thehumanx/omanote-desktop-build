/**
 * Desktop gallery navigation: which folder is open lives in `?folder=` so
 * browser Back returns to the gallery and a folder view survives refresh.
 * The value is an opaque id (a row id or `opaqueFolderKey`), never a name —
 * query strings end up in history and server logs.
 *
 * The open folder shows as the side sheet (`FolderSheet`) over the gallery.
 * Mobile does not use this: its drill-in drawer already owns Back and
 * edge-swipe (`useHistoryBackClose`), and a URL entry on top would make Back
 * take two presses.
 */
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const PARAM = "folder";

export function useGalleryFolderParam({
  enabled,
  validKeys,
  ready,
}: {
  enabled: boolean;
  validKeys: ReadonlySet<string>;
  /** False until content has loaded, so a cold load can't strip a valid id. */
  ready: boolean;
}) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const raw = searchParams.get(PARAM);
  const openFolderKey = enabled && raw && validKeys.has(raw) ? raw : null;

  const withoutParam = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(PARAM);
    const search = next.toString();
    return { pathname: location.pathname, search: search ? `?${search}` : "" };
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!enabled || !ready || !raw || validKeys.has(raw)) return;
    navigate(withoutParam(), { replace: true });
  }, [enabled, ready, raw, validKeys, navigate, withoutParam]);

  const openFolder = useCallback(
    (key: string, extraState?: Record<string, unknown>) => {
      const next = new URLSearchParams(searchParams);
      next.set(PARAM, key);
      navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { state: { fromGallery: true, ...extraState } });
    },
    [location.pathname, navigate, searchParams],
  );

  // Pop our own entry when we pushed it, so Back/Forward stay symmetrical;
  // a deep link has no gallery entry beneath it, so replace instead.
  const closeFolder = useCallback(() => {
    if ((location.state as { fromGallery?: boolean } | null)?.fromGallery) navigate(-1);
    else navigate(withoutParam(), { replace: true });
  }, [location.state, navigate, withoutParam]);

  return { openFolderKey, openFolder, closeFolder };
}
