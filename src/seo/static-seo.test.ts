import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import robotsTxt from "../../public/robots.txt?raw";
import sitemapXml from "../../public/sitemap.xml?raw";

describe("static SEO assets", () => {
  it("defines crawlable homepage metadata and structured data", () => {
    expect(indexHtml).toContain("<title>omanote | Capture the day before it disappears</title>");
    expect(indexHtml).toContain('name="robots" content="index, follow"');
    expect(indexHtml).toContain('rel="canonical" href="https://omanote.iambishistha.com/"');
    expect(indexHtml).toContain('property="og:url" content="https://omanote.iambishistha.com/"');
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"');
    expect(indexHtml).toContain("https://omanote.iambishistha.com/og.png");

    const jsonLd = indexHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];

    expect(jsonLd).toBeTruthy();

    const schema = JSON.parse(jsonLd ?? "{}") as {
      "@graph"?: Array<{ "@type"?: string | string[]; mainEntity?: unknown[] }>;
    };
    const graph = schema["@graph"] ?? [];
    const schemaTypes = graph.flatMap((entry) =>
      Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]],
    );

    expect(schemaTypes).toContain("WebSite");
    expect(schemaTypes).toContain("SoftwareApplication");
    expect(schemaTypes).toContain("FAQPage");
    expect(graph.find((entry) => entry["@type"] === "FAQPage")?.mainEntity).toHaveLength(10);
  });

  it("publishes robots.txt and sitemap.xml for the canonical domain", () => {
    expect(robotsTxt).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "",
        "Sitemap: https://omanote.iambishistha.com/sitemap.xml",
        "",
      ].join("\n"),
    );

    expect(sitemapXml).toContain("<loc>https://omanote.iambishistha.com/</loc>");
    expect(sitemapXml).toContain("<loc>https://omanote.iambishistha.com/privacy</loc>");
    expect(sitemapXml).toContain("<loc>https://omanote.iambishistha.com/terms</loc>");
    expect(sitemapXml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });
});
