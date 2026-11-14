import Link from "next/link";
import site from "@/site.config";

export const metadata = { title: `Page not found — ${site.name}` };

export default function NotFound() {
  return (
    <section className="container not-found">
      <p className="eyebrow">Page not found</p>
      <h1>We couldn&rsquo;t find that page.</h1>
      <p className="lede">
        The link may be old, or the page may have moved. If you were opening an invite from your
        co-parent, ask them to send a fresh one from their Manage Family page.
      </p>
      <div className="not-found-links">
        <Link href="/" className="btn">Go to the home page</Link>
        <Link href="/family" className="btn-secondary">Manage family</Link>
      </div>
      <p className="hint">
        Need help? Read the <Link href="/faq">FAQ</Link> or email{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
    </section>
  );
}
