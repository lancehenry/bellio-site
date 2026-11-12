import Link from "next/link";
import { notFound } from "next/navigation";
import site from "@/site.config";

// Pricing page. Everything here follows site.config.js → pricing:
//   show: false  → the page is hidden (shows "not found") and drops out of the footer
//   beta: true   → "Free during the beta" banner, and the button says "Join the free beta"
//   monthly / yearly / trialDays → the numbers shown

export const metadata = {
  title: `Pricing — ${site.name}`,
  description: `${site.name} pricing: one simple price per family, with a free trial.`,
};

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export default function Pricing() {
  const p = site.pricing;
  if (!p?.show) notFound();

  const yearlyPerMonth = p.yearly / 12;
  const savings = p.monthly * 12 - p.yearly;
  const cta = p.beta ? "Join the free beta" : `Start your ${p.trialDays}-day free trial`;

  const included = [
    "Text reminders the evening before anything you need to know or do",
    "Both parents or guardians, each on their own phone",
    "All your kids, with reminders grouped by child",
    "Forwarded school emails, PDFs, and newsletters, plus flyer photos by text",
    "Heads-ups ahead of days off, early releases, and deadlines",
    "Text WEEK anytime to see the next 7 days",
    "Manage Family page to fix reminders, update kids, and invite a co-parent",
  ];

  return (
    <section className="container pricing">
      <p className="eyebrow">Pricing</p>
      <h1>One simple price per family</h1>
      <p className="lede">
        Everything {site.name} does, for both parents and all your kids. Try it free for {p.trialDays} days.
      </p>

      {p.beta && (
        <div className="beta-banner" role="note">
          <strong>Free during the beta.</strong> We&rsquo;re starting with a small group of families, and{" "}
          {site.name} is free while we do. Before it isn&rsquo;t, we&rsquo;ll tell you the price and you&rsquo;ll
          choose whether to keep going. Nothing is charged without your agreement.
        </div>
      )}

      <div className="plans">
        <div className="plan">
          <h2>Monthly</h2>
          <p className="price">
            {money(p.monthly)}
            <span>/month</span>
          </p>
          <p className="plan-note">per family, billed monthly</p>
          <ul className="plan-points">
            <li>{p.trialDays}-day free trial</li>
            <li>Cancel anytime</li>
          </ul>
          <Link href="/#signup" className="btn-secondary plan-btn">
            {cta}
          </Link>
        </div>

        <div className="plan featured">
          <p className="plan-badge">Best value</p>
          <h2>Yearly</h2>
          <p className="price">
            {money(p.yearly)}
            <span>/year</span>
          </p>
          <p className="plan-note">
            per family, about {money(Math.round(yearlyPerMonth * 100) / 100)} a month
          </p>
          <ul className="plan-points">
            <li>{p.trialDays}-day free trial</li>
            <li>
              <strong>Save {money(savings)}</strong> compared with monthly
            </li>
          </ul>
          <Link href="/#signup" className="btn plan-btn">
            {cta}
          </Link>
        </div>
      </div>

      <div className="setup-card included">
        <h2>Every plan includes</h2>
        <ul className="check-list">
          {included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="pricing-faq">
        <h2>Questions about pricing</h2>
        <details className="faq-item">
          <summary>How does the free trial work?</summary>
          <div className="faq-answer">
            <p>
              You get {p.trialDays} days of everything {site.name} does, free. That&rsquo;s long enough to see a
              full month of school newsletters. We&rsquo;ll text you before your trial ends, and you can cancel
              anytime before then without paying anything.
            </p>
          </div>
        </details>
        <details className="faq-item">
          <summary>Is the price per parent or per family?</summary>
          <div className="faq-answer">
            <p>
              Per family. One price covers up to 2 adults, each with their own phone, and all your kids.
            </p>
          </div>
        </details>
        <details className="faq-item">
          <summary>We live in two houses. Do we each pay?</summary>
          <div className="faq-answer">
            <p>
              Not if you share one family: one price covers you both. If you&rsquo;d rather each have your own
              separate family account, each one has its own plan.
            </p>
          </div>
        </details>
        <details className="faq-item">
          <summary>Can I cancel anytime?</summary>
          <div className="faq-answer">
            <p>
              Yes. There&rsquo;s no contract. Texts stop, and you can delete your family and its data on the{" "}
              <Link href="/family">Manage Family</Link> page.
            </p>
          </div>
        </details>
        <details className="faq-item">
          <summary>Do texts cost extra?</summary>
          <div className="faq-answer">
            <p>
              {site.name} doesn&rsquo;t charge per text. Your carrier&rsquo;s standard message and data rates may
              apply.
            </p>
          </div>
        </details>
        <p className="hint">
          More questions? See the <Link href="/faq">FAQ</Link> or email{" "}
          <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
        </p>
      </div>
    </section>
  );
}
