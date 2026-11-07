import "./globals.css";
import Link from "next/link";
import site from "@/site.config";

export const metadata = {
  title: `${site.name} — School emails, turned into texts you'll actually read`,
  description:
    "Forward your school emails to Bellio and get a short text the night before anything you need to know or do.",
  metadataBase: new URL(site.url),
};

function BellIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a6 6 0 0 0-6 6v3.6l-1.6 2.7A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.7L18 12.6V9a6 6 0 0 0-6-6Z"
        fill="currentColor"
      />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0h-5Z" fill="currentColor" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <BellIcon />
              </span>
              {site.name}
            </Link>
            <Link href="/#signup" className="header-cta">
              Sign up
            </Link>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container footer-inner">
            <p>
              © 2026 {site.legalName}. Questions?{" "}
              <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </p>
            <nav>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">SMS Terms</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
