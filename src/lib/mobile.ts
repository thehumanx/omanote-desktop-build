import { useEffect, useState } from "react";

export const MOBILE_VIEWPORT_MEDIA_QUERY = "(max-width: 767px)";

export function isMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches;
}

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(isMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);
    const handler = () => setIsMobile(mediaQueryList.matches);
    handler();
    mediaQueryList.addEventListener("change", handler);
    return () => mediaQueryList.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
