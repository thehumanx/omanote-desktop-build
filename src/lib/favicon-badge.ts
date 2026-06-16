let originalFaviconHref: string | null = null;
let originalTitle: string | null = null;

function getFaviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>("link[rel~='icon']");
}

function ensureOriginals() {
  if (!originalFaviconHref) {
    originalFaviconHref = getFaviconLink()?.href ?? null;
  }
  if (!originalTitle) {
    originalTitle = document.title;
  }
}

export function setFaviconBadge(count: number): void {
  ensureOriginals();

  // Update document title
  if (originalTitle !== null) {
    document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
  }

  const link = getFaviconLink();
  if (!link || !originalFaviconHref) return;

  if (count <= 0) {
    link.href = originalFaviconHref;
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = originalFaviconHref;
  img.onload = () => {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the original favicon
    ctx.drawImage(img, 0, 0, size, size);

    // Badge circle (bottom-right quadrant)
    const badgeRadius = size * 0.28;
    const cx = size - badgeRadius;
    const cy = size - badgeRadius;

    ctx.beginPath();
    ctx.arc(cx, cy, badgeRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Count label
    const label = count > 9 ? "9+" : String(count);
    const fontSize = Math.floor(badgeRadius * 1.3);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 0.5);

    link.href = canvas.toDataURL("image/png");
  };
}
