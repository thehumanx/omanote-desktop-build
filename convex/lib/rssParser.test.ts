import { describe, expect, it } from "vitest";
import { extractFeedLinks, looksLikeFeed, parseFeed, stripHtml } from "./rssParser";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example &amp; Friends</title>
    <link>https://example.com</link>
    <description>An example blog</description>
    <item>
      <title>First post</title>
      <link>https://example.com/first</link>
      <guid isPermaLink="false">post-1</guid>
      <pubDate>Mon, 08 Jun 2026 10:00:00 GMT</pubDate>
      <dc:creator>Jane Doe</dc:creator>
      <description><![CDATA[<p>Hello <b>world</b> with an <img src="https://example.com/pic.jpg"> image.</p>]]></description>
      <content:encoded><![CDATA[<p>Full content here.</p>]]></content:encoded>
    </item>
    <item>
      <title>Second post</title>
      <link>https://example.com/second</link>
      <enclosure url="https://example.com/thumb.png" type="image/png" length="1"/>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <subtitle>Atom subtitle</subtitle>
  <link rel="alternate" type="text/html" href="https://atom.example.com"/>
  <entry>
    <id>tag:atom.example.com,2026:entry-1</id>
    <title>Atom entry</title>
    <link rel="alternate" href="https://atom.example.com/entry-1"/>
    <published>2026-06-08T12:00:00Z</published>
    <author><name>Sam Writer</name></author>
    <summary>Short summary</summary>
    <content type="html">&lt;p&gt;Atom content&lt;/p&gt;</content>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS 2.0 with CDATA, entities, creators, and thumbnails", () => {
    const feed = parseFeed(RSS2);
    expect(feed).not.toBeNull();
    expect(feed!.title).toBe("Example & Friends");
    expect(feed!.siteUrl).toBe("https://example.com");
    expect(feed!.items).toHaveLength(2);

    const [first, second] = feed!.items;
    expect(first!.guid).toBe("post-1");
    expect(first!.url).toBe("https://example.com/first");
    expect(first!.author).toBe("Jane Doe");
    expect(first!.contentHtml).toContain("Full content");
    expect(first!.summary).toContain("Hello world");
    expect(first!.thumbnailUrl).toBe("https://example.com/pic.jpg");
    expect(first!.publishedAt).toBe(Date.parse("Mon, 08 Jun 2026 10:00:00 GMT"));

    expect(second!.guid).toBe("https://example.com/second");
    expect(second!.thumbnailUrl).toBe("https://example.com/thumb.png");
  });

  it("parses Atom feeds", () => {
    const feed = parseFeed(ATOM);
    expect(feed).not.toBeNull();
    expect(feed!.title).toBe("Atom Example");
    expect(feed!.siteUrl).toBe("https://atom.example.com");
    expect(feed!.items).toHaveLength(1);

    const [entry] = feed!.items;
    expect(entry!.guid).toBe("tag:atom.example.com,2026:entry-1");
    expect(entry!.url).toBe("https://atom.example.com/entry-1");
    expect(entry!.author).toBe("Sam Writer");
    expect(entry!.contentHtml).toContain("Atom content");
    expect(entry!.publishedAt).toBe(Date.parse("2026-06-08T12:00:00Z"));
  });

  it("returns null for things that are not feeds", () => {
    expect(parseFeed("<html><body>nope</body></html>")).toBeNull();
    expect(parseFeed("not xml at all")).toBeNull();
  });
});

describe("extractFeedLinks", () => {
  it("finds advertised feeds and resolves relative URLs", () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="https://example.com/atom">
      <link rel="stylesheet" href="/style.css">
    </head></html>`;
    expect(extractFeedLinks(html, "https://example.com/blog")).toEqual([
      "https://example.com/feed.xml",
      "https://example.com/atom",
    ]);
  });

  it("returns an empty list when no feeds are advertised", () => {
    expect(extractFeedLinks("<html><head></head></html>", "https://example.com")).toEqual([]);
  });
});

describe("looksLikeFeed", () => {
  it("detects feeds by content type and body", () => {
    expect(looksLikeFeed("application/rss+xml", RSS2)).toBe(true);
    expect(looksLikeFeed(null, ATOM)).toBe(true);
    expect(looksLikeFeed("text/html", "<html></html>")).toBe(false);
    expect(looksLikeFeed(null, "<html></html>")).toBe(false);
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>A &amp; B &#x27;quoted&#x27;</p>")).toBe("A & B 'quoted'");
  });
});
