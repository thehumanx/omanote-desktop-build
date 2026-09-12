import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/react";
import { CookieNotice } from "../components/CookieNotice";
import { Zap, MousePointerClick, Lock, Puzzle, Monitor, ChevronDown, Layers, Hash, RefreshCw, CalendarDays, LayoutDashboard, Bell, Share2, Download, Image as ImageIcon } from "lucide-react";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { SeoHead } from "../seo/SeoHead";
import { color } from "../design-system/tokens";
import { readDismissedFlag, writeDismissedFlag } from "../lib/local-storage";
import { parseLatestVersion } from "../lib/update-checker";
import { useOutsideClick } from "../lib/useOutsideClick";
import { ProductTour } from "./landing/ProductTour";
import { ChromeLogo, FirefoxLogo } from "./landing/browser-logos";
import { ExtensionCaptureDemo } from "./landing/ExtensionCaptureDemo";
import { FAQ_ITEMS } from "./landing-data";

const CTA_BG = color.brandCta;
const CTA_BORDER = color.brandCtaHover;
const CTA_INK = color.brandCtaInk;
const CTA_HAIRLINE = color.brandCtaHairline;
const CLOSING_SECTION_BG = color.brandCtaWash;
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

// ─── Nav download dropdown ────────────────────────────────────────────────────
function DownloadNavDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(menuRef, open, () => setOpen(false));

  return (
    <div ref={menuRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((c) => !c)}
        className="inline-flex items-center gap-1.5 text-sm text-app-ink-muted hover:text-app-ink transition-colors duration-app-fast ease-app-out font-medium"
      >
        Download
        <ChevronDown
          className={[
            "h-3.5 w-3.5 transition-transform duration-app-base ease-app-out",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>
      <div
        aria-hidden={!open}
        className={[
          "absolute right-0 top-full z-30 mt-3 w-48 overflow-hidden rounded-2xl border border-app-line bg-app-surface p-2 shadow-soft",
          "origin-top-right transition-[opacity,transform] duration-app-base ease-app-out",
          open ? "pointer-events-auto opacity-100 translate-y-0 scale-100" : "pointer-events-none opacity-0 translate-y-1 scale-[0.98]",
        ].join(" ")}
      >
        <a
          href="#extension"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-app-compact rounded-app-panel px-app-field-x py-app-field-y text-left text-sm text-app-ink-muted transition duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink"
        >
          <Puzzle className="h-4 w-4" />
          Extension
        </a>
        <a
          href={desktopAppReleaseUrl}
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-app-compact rounded-app-panel px-app-field-x py-app-field-y text-left text-sm text-app-ink-muted transition duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink"
        >
          <Monitor className="h-4 w-4" />
          Desktop app
        </a>
      </div>
    </div>
  );
}

// ─── RSS announcement banner ──────────────────────────────────────────────────
const RSS_BANNER_KEY = "omanote_pages_banner_dismissed";

function RssBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readDismissedFlag(RSS_BANNER_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    writeDismissedFlag(RSS_BANNER_KEY);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="px-4 py-2" style={{ backgroundColor: CTA_BG }}>
      <p className="text-center text-sm font-medium text-white">
        Feature announcement: canvas pages and image uploads are here. Write full documents and drop in images.{" "}
        <button
          type="button"
          onClick={dismiss}
          className="font-bold text-white underline underline-offset-2 hover:no-underline cursor-pointer"
        >
          Dismiss
        </button>
      </p>
    </div>
  );
}

// ─── Extension section ────────────────────────────────────────────────────────
function ExtensionSection() {
  return (
    <section id="extension" className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: popup mockup */}
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="relative">
              {/* Subtle glow behind the popup */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-20 -z-10"
                style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
              />
              <ExtensionCaptureDemo />
            </div>
          </div>

          {/* Right: copy + download buttons */}
          <div className="order-1 lg:order-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              Browser extension
            </p>
            <h2 className="font-serif-heading mt-4 text-3xl sm:text-4xl font-black leading-tight">
              Capture from anywhere,<br className="hidden sm:block" /> without switching tabs.
            </h2>
            <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
              Save a bookmark, write a note, or log a todo from any page, without leaving the tab
              you're on. Everything goes straight into your encrypted canvas.
            </p>

            <ul className="mt-7 space-y-4">
              {[
                {
                  icon: Zap,
                  title: "Instant popup",
                  body: "Click the toolbar icon from any tab to open quick capture.",
                },
                {
                  icon: MousePointerClick,
                  title: "Select and save",
                  body: "Highlight text on any page and omanote offers to keep it, as a note or a bookmark.",
                },
                {
                  icon: Lock,
                  title: "Same encryption",
                  body: "Uses your omanote passphrase. Nothing leaves your device unencrypted.",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <f.icon className="h-5 w-5 shrink-0 mt-0.5 text-app-ink-muted" />
                  <p className="text-[15px] leading-snug text-app-ink-muted">
                    <strong className="text-app-ink font-bold">{f.title}</strong>
                    {". "}
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>

            {/* Download buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://chromewebstore.google.com/detail/omanote/foafmfgfdbdiiggmmfdoalgpfhkejbjn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors duration-app-fast ease-app-out shadow-sm"
              >
                <ChromeLogo className="h-4 w-4" />
                Add to Chrome / Chromium
              </a>
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/omanote/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors duration-app-fast ease-app-out shadow-sm"
              >
                <FirefoxLogo className="h-4 w-4" />
                Add to Firefox
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function JournalCta({ label = "Start your daily canvas", inverted }: { label?: string; inverted?: boolean }) {
  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
      <button
        className="relative inline-flex items-center overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer transition-[transform,filter] duration-app-fast ease-app-out hover:brightness-110 active:translate-y-px active:scale-[0.98]"
        style={inverted ? {
          backgroundColor: CTA_INK,
          border: `1px solid ${CTA_HAIRLINE}`,
          boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.35)",
          color: CTA_BG,
        } : {
          backgroundColor: CTA_BG,
          border: `1px solid ${CTA_BORDER}`,
          boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.35)",
          color: CTA_INK,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={inverted ? { boxShadow: "inset 0px 2px 2px 0px rgba(0,0,0,0.04)" } : { boxShadow: "inset 0px 3px 4px 0px rgba(255,255,255,0.22)" }}
        />
        <span className="relative z-10">{label}</span>
      </button>
    </SignInButton>
  );
}

// ─── Main landing page ────────────────────────────────────────────────────────
export function LandingScreen() {
  const year = new Date().getFullYear();
  const currentVersion = parseLatestVersion(changelogMarkdown)?.version ?? "v0.9";
  // The tour takes the whole viewport, so the page nav slides away for the
  // duration — otherwise it sits on top of the app it's meant to be showing.
  const [tourActive, setTourActive] = useState(false);

  return (
    <>
      <SeoHead
        title="omanote | A canvas for your thoughts"
        description="omanote is a canvas for your thoughts: one page for each day, where notes, todos, bookmarks and events land in the order they happened."
      />
      <div className="public-page min-h-screen flex flex-col bg-app-surface text-app-ink">
      {/* Nav */}
      <nav
        className={`border-b border-app-line sticky top-0 bg-app-surface/95 backdrop-blur-sm z-20 transition-[transform,opacity] duration-app-slow ${
          // Leaves on an ease-in (accelerating out of the way), comes back on
          // an ease-out (decelerating into place) — an entrance that eases in
          // reads as sluggish, and this one is the noticeable half.
          tourActive
            ? "pointer-events-none -translate-y-full opacity-0 ease-app-in"
            : "translate-y-0 opacity-100 ease-app-out"
        }`}
      >
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <img src="/logo.svg" alt="omanote home" className="h-6 sm:h-7 w-auto" />
          <div className="flex items-center gap-4 sm:gap-6">
            <DownloadNavDropdown />
            <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
              <button className="text-sm text-app-ink-muted hover:text-app-ink transition-colors duration-app-fast ease-app-out cursor-pointer font-medium">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </nav>

      {/* RSS announcement banner */}
      <RssBanner />

      <main className="flex-1">
        {/* Hero. The pinned product tour owns the hero copy at every width and
            reveals the main CTA only once it has explained itself. */}
        <ProductTour cta={<JournalCta label="Open your canvas. It's free" />} onActiveChange={setTourActive} />

        {/* Offerings */}
        <section id="offerings" className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Offerings</p>
              <h2 className="font-serif-heading mt-4 text-3xl sm:text-4xl font-black leading-tight">
                What's in it so far.
              </h2>
              <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px] max-w-[560px] mx-auto">
                A running list of what has shipped since the first version.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Layers,
                  title: "Multi-page canvas",
                  body: "Full documents inside Canvas, with headings, checklists, links, and images. Create as many as you want, and share any single page as a read-only link.",
                  span: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
                  large: true,
                },
                {
                  icon: Hash,
                  title: "Hashtags connect everything",
                  body: "Tag a note, a todo, and an event with #health. Now they're linked — Explore and Insights turn the pattern into something you can revisit.",
                  span: "sm:col-span-2 lg:col-span-2",
                },
                {
                  icon: RefreshCw,
                  title: "Recurring todos",
                  body: "Type \"every mon and fri\" or \"pay rent every month until December\" and omanote sets the schedule. Repeats daily, weekly, monthly, or on chosen weekdays, with an end date or a fixed count.",
                  span: "sm:col-span-2 lg:col-span-2",
                },
                {
                  icon: CalendarDays,
                  title: "Google Calendar sync",
                  body: "Todos and Google Calendar events flow both ways, automatically. Mention @someone's email in a todo to invite them.",
                  span: "",
                },
                {
                  icon: LayoutDashboard,
                  title: "Insights",
                  body: "Completion rate, overdue rate, and a 365-day activity heatmap.",
                  span: "",
                },
                {
                  icon: Bell,
                  title: "Natural-language reminders",
                  body: "\"Drink water every 30 minutes for 6 hours\" — parsed and scheduled as you type.",
                  span: "",
                },
                {
                  icon: ImageIcon,
                  title: "Image uploads",
                  body: "Drop images into a page, resize and caption inline. Encrypted before upload.",
                  span: "",
                },
                {
                  icon: Share2,
                  title: "Share any folder",
                  body: "Todo folders, note folders, and bookmark categories can each become a read-only public link. The rest of your canvas stays encrypted and private.",
                  span: "sm:col-span-2 lg:col-span-2",
                },
                {
                  icon: Download,
                  title: "Export & import",
                  body: "Export everything as plain text once decrypted, and import it back. Use it to move accounts or keep your own backup.",
                  span: "sm:col-span-2 lg:col-span-2",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={[
                    "flex flex-col rounded-2xl border border-app-line bg-app-surface p-5 text-left",
                    card.large ? "justify-between lg:p-6" : "",
                    card.span,
                  ].join(" ")}
                >
                  <card.icon className={card.large ? "h-8 w-8 text-app-ink-muted" : "h-6 w-6 text-app-ink-muted"} />
                  <div className={card.large ? "mt-6" : "mt-3"}>
                    {/* `font-semibold`, not `font-bold`: index.css remaps
                        `.font-bold` to --app-font-bold-weight (500), so
                        semibold's 600 is a step *up* from it here, and the only
                        stop between that 500 and `font-black`'s 900. */}
                    <p className={card.large ? "text-base font-semibold text-app-ink" : "text-sm font-semibold text-app-ink"}>
                      {card.title}
                    </p>
                    <p className="mt-1.5 text-sm text-app-ink-muted leading-snug">{card.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Extension */}
        <ExtensionSection />

        {/* Privacy */}
        <section className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Privacy</p>
            <h2 className="font-serif-heading mt-4 text-2xl sm:text-3xl font-black leading-tight">
              Your data stays private.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-app-ink-muted max-w-[560px] mx-auto">
              Content is encrypted on your device before it is stored. Unlock it with your
              passphrase, capture offline, and keep a recovery key as a backup way in.
            </p>
            <Link
              to="/privacy"
              className="mt-5 inline-flex text-sm text-app-ink underline underline-offset-2 hover:no-underline transition-colors duration-app-fast ease-app-out"
            >
              Read the privacy policy →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">FAQ</p>
            <h2 className="font-serif-heading mt-4 text-2xl sm:text-3xl font-black leading-tight">
              Common questions.
            </h2>
            <div className="mt-8 border-t border-app-line">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-12 py-6 border-b border-app-line"
                >
                  <p className="text-sm font-bold text-app-ink leading-snug">{item.question}</p>
                  <p className="text-sm text-app-ink-muted leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The name */}
        <section id="why" className="border-t border-app-line">
          <div className="max-w-[620px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              The name
            </p>
            <h2 className="font-serif-heading mt-4 text-3xl sm:text-4xl font-black leading-tight">
              Built for an audience of one, <br /> shared publicly.
            </h2>
            <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
              omanote is the all-in-one daily canvas I wanted for myself. It isn't here to
              replace your other tools, so it's opinionated about how you save things — built
              on a "dump it all in, one canvas per day" philosophy.
            </p>
            <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
              Thus the name. <strong className="text-app-ink">Omakase</strong> (お任せ) is
              Japanese for "I'll leave it to you", the trust you place in a chef who handles
              the menu for you. No menu, no decisions.
            </p>
            <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
              The structure is already there: the canvas to start, then notes, todos,
              bookmarks, events, pages, RSS, Insights, and Explore, already there when you
              need them.
            </p>
            <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
              Inspired by the concept behind{" "}
              <a
                href="https://omarchy.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-app-ink underline underline-offset-2 hover:no-underline"
              >
                Omarchy by DHH
              </a>{" "}
              and its ready-to-use approach. Oh, I use Omarchy btw.
            </p>
          </div>
        </section>

        {/* Closing CTA.

            Deliberately not a second pitch. The tour's outro already makes the
            case and offers the button on desktop, and on mobile the static hero
            does; restating it here read as the same block twice. What the foot
            of the page still owes a visitor is a way in without scrolling back
            up, so this is just that — an exit ramp, one size on every
            breakpoint. */}
        <section className="border-t border-app-line">
          <div
            className="max-w-[1136px] mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center rounded-3xl my-8 sm:my-12" style={{ backgroundColor: CLOSING_SECTION_BG }}
          >
            <h2 className="font-serif-heading text-2xl sm:text-3xl font-black leading-tight text-app-ink">
              Ready when you are.
            </h2>
            <p className="mt-3 max-w-[400px] mx-auto leading-relaxed text-[15px] text-app-ink-muted">
              A minute to set up. Free while it's in early access.
            </p>
            <div className="mt-7 flex justify-center">
              <JournalCta label="Open your canvas →" />
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-app-line">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
            {/* Left: identity, blurbs, copyright — all text copy lives here. */}
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="omanote home" className="h-5 w-auto" />
                <Link
                  to="/updates"
                  className="rounded-full border border-app-line bg-app-canvas px-2 py-0.5 text-[10px] font-bold text-app-ink-muted hover:border-app-line-strong hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out cursor-pointer"
                >
                  {currentVersion}
                </Link>
              </div>
              <p className="mt-2.5 text-xs text-app-ink-faint leading-relaxed max-w-[300px]">
                Personal notetaking app of{" "}
                <a
                  href="https://iambishistha.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  iambishistha.com
                </a>
                .
                <span className="block">Built for personal use, shared publicly.</span>
              </p>
              <p className="mt-3 text-xs text-app-ink-faint">© {year} omanote. All rights reserved.</p>
            </div>

            {/* Right: link groups only. */}
            <div className="flex gap-12">
              <div className="flex flex-col gap-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Product</p>
                <a
                  href="https://omanote.com/s/FeUM44Rd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Roadmap
                </a>
                <Link
                  to="/guide"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Guide
                </Link>
                <Link
                  to="/updates"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Changelog
                </Link>
                <a
                  href={desktopAppReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Desktop app
                </a>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Legal</p>
                <Link
                  to="/privacy"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie notice */}
      <CookieNotice />
    </div>
    </>
  );
}
