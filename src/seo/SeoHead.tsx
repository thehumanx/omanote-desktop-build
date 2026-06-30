import { Helmet } from "react-helmet-async";

const DEFAULT_TITLE = "omanote | Capture the day before it disappears";
const DEFAULT_DESCRIPTION =
  "omanote is your personal daily workspace for capturing notes, todos, bookmarks, events, and small moments before the day disappears.";
const SITE_URL = "https://omanote.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`;

type SeoHeadProps = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
};

export function SeoHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  canonical = SITE_URL,
  noIndex = false,
}: SeoHeadProps) {
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="omanote daily workspace preview" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={ogImage} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  );
}
