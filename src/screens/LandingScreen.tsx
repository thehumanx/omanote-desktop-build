import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/react";
import { CookieNotice } from "../components/CookieNotice";
import { Button } from "../components/ui";
import { Zap, MousePointerClick, Lock, Puzzle, Monitor, ChevronDown } from "lucide-react";
import { SeoHead } from "../seo/SeoHead";
import { color } from "../design-system/tokens";
import { readDismissedFlag, writeDismissedFlag } from "../lib/local-storage";
import { useOutsideClick } from "../lib/useOutsideClick";
import { SiteFooter } from "../components/SiteFooter";
import { EcosystemOrbit } from "./landing/EcosystemOrbit";
import { Reveal } from "./landing/Reveal";
import { ProductTour } from "./landing/ProductTour";
import { ChromeLogo, FirefoxLogo } from "./landing/browser-logos";
import { ExtensionCaptureDemo } from "./landing/ExtensionCaptureDemo";
import { FAQ_ITEMS } from "./landing-data";

const CTA_BG = color.brandCta;
const CTA_BORDER = color.brandCtaHover;
const CTA_INK = color.brandCtaInk;
const CTA_HAIRLINE = color.brandCtaHairline;
const CLOSING_SECTION_BG = color.brandCtaWash;
const NAV_LINK =
  "text-sm font-medium text-app-ink-muted transition-colors duration-app-fast ease-app-out hover:text-app-ink";
/** Nav text links: the hover underline draws in rather than snapping on. */
const NAV_TEXT_LINK = `omanote-link ${NAV_LINK}`;
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
        className={`omanote-link-host inline-flex items-center gap-1.5 ${NAV_LINK}`}
      >
        {/* Underline on the label only — not under the chevron. */}
        <span className="omanote-link">Download</span>
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
          className="font-bold text-white omanote-link cursor-pointer"
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
          {/* Right on desktop, below the copy on mobile: popup mockup */}
          <Reveal className="flex justify-center lg:justify-start order-2">
            <div className="relative">
              {/* Subtle glow behind the popup */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-20 -z-10"
                style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
              />
              <ExtensionCaptureDemo />
            </div>
          </Reveal>

          {/* Left on desktop: copy + download buttons */}
          <Reveal className="order-1">
            <p className="text-[10px] font-bold uppercase text-app-ink-faint">
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
          </Reveal>
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
      {/* RSS announcement banner — above the nav, which floats over the hero. */}
      <RssBanner />

      {/* Nav. A floating pill over the hero panel rather than a bar: the
          wrapper is zero-height so the tour's panel starts at the very top of
          the page and the pill sits inside it. */}
      <nav
        className={`pointer-events-none sticky top-0 z-20 h-0 transition-[transform,opacity] duration-app-slow ${
          // Leaves on an ease-in (accelerating out of the way), comes back on
          // an ease-out (decelerating into place) — an entrance that eases in
          // reads as sluggish, and this one is the noticeable half.
          tourActive
            ? "-translate-y-24 opacity-0 ease-app-in"
            : "translate-y-0 opacity-100 ease-app-out"
        }`}
      >
        <div className="flex justify-center px-4 pt-5 sm:pt-8">
          <div
            className={`flex h-12 items-center gap-4 rounded-full border border-app-line bg-app-surface/85 pl-4 pr-1.5 shadow-app-soft backdrop-blur-md sm:gap-6 sm:pl-5 ${
              tourActive ? "pointer-events-none" : "pointer-events-auto"
            }`}
          >
            <img src="/logo.svg" alt="omanote home" className="h-6 w-auto" />
            <div className="flex items-center gap-4 sm:gap-6">
              <DownloadNavDropdown />
              <a
                href="https://omanote.com/s/FeUM44Rd"
                target="_blank"
                rel="noopener noreferrer"
                className={`hidden sm:inline ${NAV_TEXT_LINK}`}
              >
                Plans
              </a>
              <Link to="/updates" className={`hidden sm:inline ${NAV_TEXT_LINK}`}>
                Changelog
              </Link>
              <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
                <Button className="h-9 rounded-full px-4 cursor-pointer">Sign in</Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero. The pinned product tour owns the hero copy at every width and
            reveals the main CTA only once it has explained itself. */}
        <ProductTour cta={<JournalCta label="Start today's canvas — it's free" />} onActiveChange={setTourActive} />

        {/* Core & ecosystem — what omanote is, and what grows out of it. */}
        <EcosystemOrbit />

        {/* Extension */}
        <ExtensionSection />

        {/* Privacy */}
        <section className="border-t border-app-line">
          <Reveal className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <p className="text-[10px] font-bold uppercase text-app-ink-faint">Privacy</p>
            <h2 className="font-serif-heading mt-4 text-2xl sm:text-3xl font-black leading-tight">
              Your data stays private.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-app-ink-muted max-w-[560px] mx-auto">
              Content is encrypted on your device before it is stored. Unlock it with your
              passphrase, capture offline, and keep a recovery key as a backup way in.
            </p>
            <Link
              to="/privacy"
              className="mt-5 inline-flex text-sm text-app-ink omanote-link transition-colors duration-app-fast ease-app-out"
            >
              Read the privacy policy →
            </Link>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="border-t border-app-line">
          <Reveal className="max-w-[760px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <p className="text-[10px] font-bold uppercase text-app-ink-faint">FAQ</p>
            <h2 className="font-serif-heading mt-4 text-2xl sm:text-3xl font-black leading-tight">
              Common questions.
            </h2>
            {/* Native <details>, so the answers stay in the DOM while collapsed —
                they carry the page's keyword prose (see FAQ_ITEMS). */}
            <div className="mt-8 border-t border-app-line">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="group border-b border-app-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-bold text-app-ink leading-snug">{item.question}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-app-ink-faint transition-transform duration-app-fast ease-app-out group-open:rotate-180" />
                  </summary>
                  <p className="max-w-[720px] pb-5 text-sm text-app-ink-muted leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </section>

        {/* The name */}
        <section id="why" className="border-t border-app-line">
          <Reveal className="max-w-[620px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24 text-center">
            <p className="text-[10px] font-bold uppercase text-app-ink-faint">
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
                className="text-app-ink omanote-link"
              >
                Omarchy by DHH
              </a>{" "}
              and its ready-to-use approach. Oh, I use Omarchy btw.
            </p>
          </Reveal>
        </section>

        {/* Closing CTA.

            Deliberately not a second pitch. The tour's outro already makes the
            case and offers the button on desktop, and on mobile the static hero
            does; restating it here read as the same block twice. What the foot
            of the page still owes a visitor is a way in without scrolling back
            up, so this is just that — an exit ramp, one size on every
            breakpoint. */}
        <section className="border-t border-app-line">
          <Reveal>
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
              <JournalCta label="Start today's canvas →" />
            </div>
          </div>
          </Reveal>
        </section>

      </main>

      <SiteFooter />

      {/* Cookie notice */}
      <CookieNotice />
    </div>
    </>
  );
}
