import { Link } from "react-router-dom";
import { SeoHead } from "../seo/SeoHead";

const LAST_UPDATED = "July 21, 2026";
const CONTACT_EMAIL = "omanote@iambishistha.com";

export function PrivacyPolicyScreen() {
  return (
    <>
      <SeoHead
        title="Privacy Policy | omanote"
        description="omanote privacy policy — how we handle your data in this personal daily workspace."
        canonical="https://omanote.com/privacy"
      />
      <div className="public-page min-h-screen flex flex-col bg-app-surface text-app-ink">
      {/* Nav */}
      <nav className="border-b border-app-line sticky top-0 bg-app-surface/95 backdrop-blur-sm z-20">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="omanote home" className="h-6 sm:h-7 w-auto" />
          </Link>
          <Link
            to="/"
            className="text-sm text-app-ink-muted hover:text-app-ink transition-colors font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
          {/* Header */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Legal</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-app-ink-faint">Last updated: {LAST_UPDATED}</p>

          {/* Table of contents */}
          <nav className="mt-8 rounded-2xl border border-app-line bg-app-canvas px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint mb-3">
              Contents
            </p>
            <ol className="space-y-1.5 list-decimal list-inside">
              {[
                ["#who-we-are", "Who we are"],
                ["#data-we-collect", "Data we collect"],
                ["#how-we-use-data", "How we use your data"],
                ["#legal-basis", "Legal basis for processing (GDPR)"],
                ["#browser-extension", "Browser extension"],
                ["#third-parties", "Third-party services"],
                ["#google-calendar", "Google Calendar integration"],
                ["#international-transfers", "International data transfers"],
                ["#data-retention", "Data retention & deletion"],
                ["#encryption", "Encryption & your passphrase"],
                ["#your-rights", "Your rights"],
                ["#children", "Children's privacy"],
                ["#changes", "Changes to this policy"],
                ["#contact", "Contact"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-sm text-app-ink-muted hover:text-app-ink transition-colors underline-offset-2 hover:underline"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Intro */}
          <p className="mt-10 text-[15px] text-app-ink-muted leading-relaxed">
            This Privacy Policy describes how omanote ("we," "us," or "our") collects, uses, and
            protects information when you use the omanote web application and browser extension
            (collectively, the "Service"). By using the Service, you agree to the practices
            described in this policy.
          </p>

          {/* Sections */}
          <div className="mt-10 space-y-12">

            {/* 1 */}
            <section id="who-we-are">
              <h2 className="text-lg font-black text-app-ink tracking-tight">1. Who we are</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  omanote is an independently developed personal productivity application operated
                  by an individual developer. The data controller responsible for your personal data
                  is reachable at{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            </section>

            {/* 2 */}
            <section id="data-we-collect">
              <h2 className="text-lg font-black text-app-ink tracking-tight">2. Data we collect</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-4">
                <div>
                  <p className="font-bold text-app-ink mb-1">Account information</p>
                  <p>
                    When you create an account, we collect your email address and display name via
                    our authentication provider, Clerk. We do not store passwords directly.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-app-ink mb-1">User-generated content</p>
                  <p>
                    Notes, todos, bookmarks, and events you create are encrypted on your device
                    before being stored. We receive and store only ciphertext — we cannot read the
                    content of your entries.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-app-ink mb-1">Technical and usage data</p>
                  <p>
                    We do not use analytics tools or behavioral tracking. Standard server logs
                    (request timestamps, error codes, anonymised IP addresses) may be retained for
                    up to 30 days for security and operational purposes only.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-app-ink mb-1">Local storage</p>
                  <p>
                    The browser extension stores your encrypted authentication token and derived
                    encryption key material in the browser's local extension storage. The web app
                    uses browser localStorage and IndexedDB to support offline operation. This data
                    stays on your device and is not transmitted unless you explicitly save content.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-app-ink mb-1">Connected accounts (optional)</p>
                  <p>
                    If you choose to connect your Google account for Calendar sync, we receive
                    Google Calendar event data (titles, times, descriptions, and similar details) as
                    described in{" "}
                    <a href="#google-calendar" className="text-app-ink underline underline-offset-2 hover:no-underline">
                      Google Calendar integration
                    </a>{" "}
                    below.
                  </p>
                </div>
              </div>
            </section>

            {/* 3 */}
            <section id="how-we-use-data">
              <h2 className="text-lg font-black text-app-ink tracking-tight">3. How we use your data</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>We use the data we collect exclusively to:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-1">
                  <li>Authenticate you and maintain your account session.</li>
                  <li>Store and synchronise your encrypted content across your devices.</li>
                  <li>Diagnose technical problems and maintain service reliability.</li>
                  <li>Respond to your support or data-access requests.</li>
                </ul>
                <p>
                  We do not use your data for advertising, profiling, or any purpose beyond
                  operating the Service. We do not sell your data to any third party.
                </p>
              </div>
            </section>

            {/* 4 */}
            <section id="legal-basis">
              <h2 className="text-lg font-black text-app-ink tracking-tight">4. Legal basis for processing (GDPR)</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  If you are located in the European Economic Area (EEA) or United Kingdom, we
                  process your personal data under the following legal bases:
                </p>
                <ul className="space-y-3">
                  {[
                    {
                      basis: "Performance of a contract",
                      detail:
                        "Processing your account information and user-generated content is necessary to provide the Service you signed up for.",
                    },
                    {
                      basis: "Legitimate interests",
                      detail:
                        "Retaining minimal server logs for security monitoring and service reliability, where our interests do not override your rights.",
                    },
                    {
                      basis: "Compliance with legal obligations",
                      detail:
                        "We may process data where required by applicable law or a court order.",
                    },
                  ].map(({ basis, detail }) => (
                    <li key={basis} className="flex items-start gap-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-app-line-strong shrink-0" />
                      <p>
                        <strong className="text-app-ink">{basis}:</strong> {detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 5 */}
            <section id="browser-extension">
              <h2 className="text-lg font-black text-app-ink tracking-tight">5. Browser extension</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-4">
                <p>
                  The omanote browser extension requests the following permissions. Each is used
                  solely for the stated purpose and for no other reason.
                </p>
                <ul className="space-y-3">
                  {[
                    {
                      perm: "activeTab",
                      why: "Reads the URL and title of the current tab only when you explicitly invoke the extension (clicking the toolbar icon or using a context-menu action). The extension does not access tab content passively or in the background.",
                    },
                    {
                      perm: "contextMenus",
                      why: 'Adds a "Save to omanote" right-click option on pages and selected text. Nothing is sent until you confirm.',
                    },
                    {
                      perm: "storage",
                      why: "Caches your encrypted authentication token and encryption state in the browser's local extension storage. This data never leaves your device except as part of the normal authentication flow.",
                    },
                    {
                      perm: "scripting / tabs",
                      why: "Used only during the one-time sign-in flow to open the omanote authentication page and inject the minimal bridge script that completes sign-in. Not used for passive monitoring.",
                    },
                    {
                      perm: "alarms",
                      why: "Schedules periodic token refresh in the background so your session remains active without requiring manual re-login.",
                    },
                  ].map(({ perm, why }) => (
                    <li key={perm} className="flex items-start gap-3">
                      <code className="shrink-0 rounded-md border border-app-line bg-app-canvas px-2 py-0.5 text-[12px] font-mono text-app-ink-muted mt-0.5">
                        {perm}
                      </code>
                      <p className="leading-relaxed">{why}</p>
                    </li>
                  ))}
                </ul>
                <p>
                  The extension does not read browsing history, monitor pages you visit, capture
                  keystrokes, or transmit any data to parties other than the omanote backend when
                  you explicitly save content.
                </p>
                <p>
                  All content saved via the extension is encrypted with your omanote passphrase on
                  your device before it is transmitted to the server.
                </p>
              </div>
            </section>

            {/* 6 */}
            <section id="third-parties">
              <h2 className="text-lg font-black text-app-ink tracking-tight">6. Third-party services</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-4">
                <p>
                  omanote uses the following sub-processors. We have agreements in place with each
                  that restrict their use of your data to providing services to us.
                </p>
                <ul className="space-y-3">
                  {[
                    {
                      name: "Clerk",
                      role: "Authentication and identity management. Handles sign-up, sign-in, and session tokens. Clerk processes your email address and display name.",
                      url: "https://clerk.com/privacy",
                    },
                    {
                      name: "Convex",
                      role: "Cloud database and backend infrastructure. Stores your encrypted content. Convex cannot decrypt your data and has no access to its contents.",
                      url: "https://www.convex.dev/privacy",
                    },
                    {
                      name: "Google",
                      role: "Only if you connect Google Calendar sync (optional, off by default). See Google Calendar integration below for what data is involved and how it's used.",
                      url: "https://policies.google.com/privacy",
                    },
                  ].map(({ name, role, url }) => (
                    <li key={name} className="rounded-xl border border-app-line bg-app-canvas px-4 py-3">
                      <p className="text-sm font-bold text-app-ink">{name}</p>
                      <p className="mt-1 text-sm text-app-ink-muted leading-relaxed">{role}</p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-block text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
                <p>
                  No advertising networks, analytics providers, or other tracking services are used.
                </p>
              </div>
            </section>

            {/* 7 */}
            <section id="google-calendar">
              <h2 className="text-lg font-black text-app-ink tracking-tight">7. Google Calendar integration</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  Connecting Google Calendar is entirely optional, off by default, and available
                  from Settings. If you connect it, omanote requests access to your Google Calendar
                  (the <code className="rounded-md border border-app-line bg-app-canvas px-1.5 py-0.5 text-[13px] font-mono">calendar</code> OAuth
                  scope) solely to provide two-way sync between your todos/events and your Google
                  Calendar:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1">
                  <li>
                    We read event details (title, description, start/end time, location, and any
                    video-conferencing link) from your primary Google Calendar, to create matching
                    todos in omanote and to detect edits or cancellations to events you've already
                    imported.
                  </li>
                  <li>
                    We create, update, and delete events on a dedicated "omanote" Google Calendar
                    (and, when you edit a todo that originated from an imported Google event, on
                    that original event) to reflect your open and completed todos.
                  </li>
                  <li>
                    We do not access any other Google data — no Gmail, Drive, Contacts, or any
                    calendar beyond the ones described above.
                  </li>
                </ul>
                <p>
                  Google user data obtained this way is used only to provide the sync features
                  described here. Titles and notes are encrypted client-side the same as your other
                  content before being stored; the scheduling metadata needed to run the sync itself
                  (dates, times, and Google's own event identifiers) is stored in plaintext, since
                  our servers never hold the key needed to encrypt or decrypt it. This data is never
                  used for advertising, never sold, and never shared with anyone other than Google
                  (to perform the sync) and Convex (see Third-party services above). No one at
                  omanote reads it except when necessary to investigate a bug or support request you
                  raise yourself.
                </p>
                <p>
                  You can disconnect Google Calendar sync at any time from Settings, which revokes
                  omanote's access to your Google account. omanote's use and transfer of information
                  received from Google APIs adheres to the{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including its Limited Use requirements.
                </p>
              </div>
            </section>

            {/* 8 */}
            <section id="international-transfers">
              <h2 className="text-lg font-black text-app-ink tracking-tight">8. International data transfers</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  Our sub-processors (Clerk and Convex) are headquartered in the United States.
                  If you are located in the EEA, UK, or another jurisdiction with data transfer
                  restrictions, your account information may be transferred to and processed in the
                  United States.
                </p>
                <p>
                  Such transfers rely on the sub-processors' own compliance mechanisms (including
                  Standard Contractual Clauses where applicable). Your user-generated content is
                  encrypted before transfer, meaning only ciphertext is processed by US
                  infrastructure.
                </p>
              </div>
            </section>

            {/* 9 */}
            <section id="data-retention">
              <h2 className="text-lg font-black text-app-ink tracking-tight">9. Data retention &amp; deletion</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  We retain your account data and encrypted content for as long as your account
                  remains active. Server logs are deleted after 30 days.
                </p>
                <p>
                  You can export all of your content at any time from the Settings screen. You can
                  delete individual items within the app.
                </p>
                <p>
                  To request deletion of your account and all associated data, email{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  . We will process deletion requests within 30 days. Note that because your
                  content is encrypted and we cannot read it, deletion is permanent and
                  irreversible.
                </p>
              </div>
            </section>

            {/* 10 */}
            <section id="encryption">
              <h2 className="text-lg font-black text-app-ink tracking-tight">10. Encryption &amp; your passphrase</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  omanote encrypts your content client-side using AES-GCM with a key derived from
                  your passphrase via PBKDF2. Encryption happens entirely in your browser before
                  any data is transmitted. We never receive your passphrase and cannot decrypt,
                  read, or recover your content.
                </p>
                <p>
                  During initial setup, omanote generates a recovery key linked to your passphrase.
                  You should store this recovery key securely offline. If you lose both your
                  passphrase and your recovery key, your encrypted data cannot be recovered by
                  anyone, including us.
                </p>
                <p>
                  This encryption model means that a data breach of our servers would not expose
                  readable content — only encrypted data that cannot be decrypted without your
                  passphrase.
                </p>
              </div>
            </section>

            {/* 11 */}
            <section id="your-rights">
              <h2 className="text-lg font-black text-app-ink tracking-tight">11. Your rights</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-4">
                <p>
                  Depending on your jurisdiction, you may have the following rights regarding your
                  personal data:
                </p>
                <ul className="space-y-3">
                  {[
                    {
                      right: "Access",
                      detail: "Request a copy of the personal data we hold about you.",
                    },
                    {
                      right: "Rectification",
                      detail: "Ask us to correct inaccurate personal data (e.g., your display name or email).",
                    },
                    {
                      right: "Erasure",
                      detail: 'Request deletion of your personal data ("right to be forgotten").',
                    },
                    {
                      right: "Restriction",
                      detail: "Ask us to restrict processing of your data in certain circumstances.",
                    },
                    {
                      right: "Data portability",
                      detail: "Receive your data in a structured, machine-readable format. You can export your content from Settings at any time.",
                    },
                    {
                      right: "Objection",
                      detail: "Object to processing based on legitimate interests.",
                    },
                    {
                      right: "Withdraw consent",
                      detail: "Where processing is based on consent, withdraw it at any time without affecting prior processing.",
                    },
                  ].map(({ right, detail }) => (
                    <li key={right} className="flex items-start gap-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-app-line-strong shrink-0" />
                      <p>
                        <strong className="text-app-ink">{right}:</strong> {detail}
                      </p>
                    </li>
                  ))}
                </ul>
                <p>
                  To exercise any of these rights, email{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  . We will respond within 30 days. You also have the right to lodge a complaint
                  with your local data protection authority.
                </p>
              </div>
            </section>

            {/* 12 */}
            <section id="children">
              <h2 className="text-lg font-black text-app-ink tracking-tight">12. Children's privacy</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  The Service is not directed at children under the age of 13 (or 16 in the EEA
                  where applicable). We do not knowingly collect personal data from children. If
                  you believe a child has provided us with personal data without parental consent,
                  please contact us at{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  and we will delete it promptly.
                </p>
              </div>
            </section>

            {/* 13 */}
            <section id="changes">
              <h2 className="text-lg font-black text-app-ink tracking-tight">13. Changes to this policy</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  We may update this policy from time to time. When we make material changes, we
                  will update the "Last updated" date at the top of this page and notify you via a
                  notice within the app. For significant changes that affect your rights, we will
                  seek fresh consent where required by law.
                </p>
                <p>
                  Continued use of the Service after the effective date of an updated policy
                  constitutes your acceptance of the revised terms, except where applicable law
                  requires a more explicit form of consent.
                </p>
              </div>
            </section>

            {/* 14 */}
            <section id="contact">
              <h2 className="text-lg font-black text-app-ink tracking-tight">14. Contact</h2>
              <div className="mt-3 text-[15px] text-app-ink-muted leading-relaxed space-y-3">
                <p>
                  For privacy-related questions, data requests, or complaints, contact us at:
                </p>
                <div className="rounded-xl border border-app-line bg-app-canvas px-4 py-3">
                  <p className="text-sm font-bold text-app-ink">omanote</p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="mt-1 inline-block text-sm text-app-ink-muted underline underline-offset-2 hover:text-app-ink transition-colors"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  <br />
                  <a
                    href="https://iambishistha.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-sm text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors"
                  >
                    iambishistha.com
                  </a>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-app-line">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Link to="/">
                  <img src="/logo.svg" alt="omanote home" className="h-5 w-auto" />
                </Link>
              </div>
              <p className="mt-2.5 text-xs text-app-ink-faint leading-relaxed max-w-[280px]">
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
              <div className="mt-3 flex gap-4 text-xs text-app-ink-faint">
                <a
                  href="https://omanote.com/s/FeUM44Rd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Roadmap
                </a>
                <Link
                  to="/updates"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Changelog
                </Link>
                <a
                  href="https://github.com/thehumanx/omanote-releases/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Desktop app
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-app-ink-faint sm:text-right">
              <span>© {new Date().getFullYear()} omanote. All rights reserved.</span>
              <span className="max-w-[300px] sm:max-w-none leading-snug">
                Your data is encrypted client-side and stored securely.
                <br className="hidden sm:block" /> We don't sell, share, or read your data. Ever.
              </span>
              <div className="flex gap-4 w-fit sm:ml-auto">
                <Link
                  to="/privacy"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
