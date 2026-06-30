import { Link } from "react-router-dom";
import { SeoHead } from "../seo/SeoHead";

const LAST_UPDATED = "May 10, 2026";
const CONTACT_EMAIL = "omanote@iambishistha.com";

export function TermsScreen() {
  return (
    <>
      <SeoHead
        title="Terms of Service | omanote"
        description="omanote terms of service — the rules for using this personal daily workspace."
        canonical="https://omanote.com/terms"
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Legal</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
            Terms of Use
          </h1>
          <p className="mt-3 text-sm text-app-ink-faint">Last updated: {LAST_UPDATED}</p>

          <div className="mt-10 space-y-10 text-[15px] text-app-ink-muted leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">1. Who this is for</h2>
              <p>
                omanote is a personal daily workspace built and maintained by{" "}
                <a
                  href="https://iambishistha.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-app-ink underline underline-offset-2 hover:no-underline"
                >
                  iambishistha.com
                </a>
                . It is offered publicly for personal, non-commercial use. By creating an account
                and using omanote, you agree to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">2. Your content</h2>
              <p>
                Everything you capture in omanote — notes, todos, bookmarks, events — is yours.
                omanote does not claim ownership of your content. Your data is encrypted on your
                device before it reaches our servers. We cannot read it. You are responsible for
                keeping your passphrase and recovery key safe.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">3. Acceptable use</h2>
              <p>Use omanote for personal, lawful purposes only. You agree not to:</p>
              <ul className="mt-3 space-y-2 list-disc list-inside text-app-ink-muted">
                <li>Use omanote to store or distribute illegal content</li>
                <li>Attempt to reverse-engineer, exploit, or disrupt the service</li>
                <li>Use the service in a way that harms other users or the infrastructure</li>
                <li>Resell, sublicense, or commercially redistribute access to omanote</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">4. Availability</h2>
              <p>
                omanote is provided as-is and as-available. It is a personal project maintained by
                one person. There is no guarantee of uptime, feature stability, or continued
                availability. We will make reasonable efforts to keep the service running and notify
                users of significant changes, but we cannot make legally binding uptime commitments.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">5. Account termination</h2>
              <p>
                You can delete your account at any time from Settings. This permanently removes your
                data from our servers. We may also suspend or terminate accounts that violate these
                terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">6. Limitation of liability</h2>
              <p>
                omanote is provided without warranties of any kind. To the extent permitted by law,
                we are not liable for any loss of data, loss of access, or damages arising from your
                use of the service — including data that becomes unrecoverable due to a forgotten
                passphrase.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">7. Changes to these terms</h2>
              <p>
                We may update these terms occasionally. Continued use of omanote after changes are
                posted means you accept the updated terms. Material changes will be announced via
                the in-app updates feed.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-app-ink mb-3">8. Contact</h2>
              <p>
                Questions about these terms?{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-app-ink underline underline-offset-2 hover:no-underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
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
