import "./globals.css";
import Link from "next/link";
import site from "@/site.config";
import HeaderCta from "./HeaderCta";

export const metadata = {
  title: `${site.name} — School emails, turned into texts you'll actually read`,
  description:
    "Forward your school emails to Bellio and get a short text the night before anything you need to know or do.",
  metadataBase: new URL(site.url),
  openGraph: {
    type: "website",
    siteName: site.name,
    url: site.url,
    title: `${site.name}: school emails, turned into texts you'll actually read`,
    description:
      "Forward school emails and flyers. Bellio texts you the night before picture day, early release, and anything you need to send. Free during the beta.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name}: school emails, turned into texts you'll actually read`,
    description: "Forward school emails and flyers. Bellio texts you the night before. Free during the beta.",
  },
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
            <HeaderCta />
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container footer-inner">
            <p>
              © 2026 {site.legalName}. Questions?{" "}
              <a className="footer-email" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </p>
            <nav>
              <Link href="/faq">FAQ</Link>
              {site.pricing?.show && <Link href="/pricing">Pricing</Link>}
              <Link href="/setup">Setup guide</Link>
              <Link href="/family">Manage family</Link>
              <Link href="/terms-of-service">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">SMS Terms</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
