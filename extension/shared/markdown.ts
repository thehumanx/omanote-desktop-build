function escapeMarkdownLinkDestination(url: string): string {
  return url.trim().replace(/\)/g, "\\)");
}

export function appendMarkdownSourceLink(content: string, url: string): string {
  const sourceUrl = escapeMarkdownLinkDestination(url);
  return `${content.trim()}\n\n[Source](${sourceUrl})`.trim();
}
