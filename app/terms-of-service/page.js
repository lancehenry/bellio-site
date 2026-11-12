import Link from "next/link";
import site from "@/site.config";

export const metadata = { title: `Terms of Service — ${site.name}` };

// Plain-English Terms of Service. The texting rules live on the SMS Terms page
// (/terms), which carriers review, and are made part of these terms in section 6.
export default function TermsOfService() {
  const email = <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>;
  return (
    <article className="container legal">
      <h1>Terms of Service</h1>
      <p className="updated">Last updated: {site.lastUpdated}</p>

      <p>
        These terms are an agreement between you and {site.legalName}, doing business as {site.name}{" "}
        (&ldquo;{site.name},&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). They cover {site.domain}, the{" "}
        {site.name} text message service, and everything else we offer (together, the
        &ldquo;Service&rdquo;). By signing up, joining a family, or using the Service, you agree to these
        terms, our <Link href="/terms">SMS Terms</Link>, and our <Link href="/privacy">Privacy Policy</Link>.
        If you don&rsquo;t agree, please don&rsquo;t use {site.name}.
      </p>

      <div className="callout">
        <strong>The most important part:</strong> {site.name} uses automated tools, including AI, to read
        school emails and flyers. Reminders can be late, incomplete, or wrong, and some items may be missed
        entirely. {site.name} is a helpful extra, not a replacement for reading your school&rsquo;s
        messages. Always check the original communication for anything important, and never rely on{" "}
        {site.name} for emergencies, health or safety matters, or deadlines you can&rsquo;t afford to miss.
      </div>

      <h2>1. What {site.name} does</h2>
      <p>
        You forward school emails to your family&rsquo;s {site.name} address or text us photos of flyers.
        We pull out dates and to-dos and send you text reminders, usually the evening before. We&rsquo;re
        currently in an early beta. Features may change, be added, or be removed as we improve the
        Service.
      </p>

      <h2>2. Who can use {site.name}</h2>
      <ul>
        <li>You must be at least 18 and a parent or legal guardian of a school-age child.</li>
        <li>You need a US mobile number that can receive text messages.</li>
        <li>
          Each family account can include up to two adults, each with their own phone number and their
          own consent to receive texts. Only invite another parent or guardian.
        </li>
        <li>
          The information you give us, such as names, phone numbers, and your children&rsquo;s grades,
          must be accurate, and you&rsquo;ll keep it up to date (you can do this on the{" "}
          <Link href="/family">Manage Family</Link> page).
        </li>
      </ul>

      <h2>3. Your account</h2>
      <p>
        You sign in with one-time links and codes sent to your phone, so keep your phone and its messages
        secure. You&rsquo;re responsible for activity on your account. If your phone number changes, update
        it on the Manage Family page. If you think someone else has used your account, email {email} right
        away.
      </p>

      <h2>4. What you send us</h2>
      <ul>
        <li>
          You keep ownership of the emails, photos, and other content you send. You give us permission to
          store, copy, and process that content (including with the AI and other service providers listed
          in our Privacy Policy) only to provide and improve the Service for you. We don&rsquo;t use
          your content to train AI models, and our AI provider isn&rsquo;t allowed to either.
        </li>
        <li>
          Only send us school communications you&rsquo;re allowed to share, such as emails and flyers your
          family received. Don&rsquo;t send us other people&rsquo;s private information beyond what
          naturally appears in those communications.
        </li>
        <li>
          If you set up automatic forwarding, you choose which emails are forwarded. Our{" "}
          <Link href="/setup">setup guide</Link> explains how to limit forwarding to school senders. Please
          don&rsquo;t forward work email or other mail that isn&rsquo;t about your children&rsquo;s school.
        </li>
        <li>
          We keep what you send only as long as our <Link href="/privacy">Privacy Policy</Link> describes.
        </li>
      </ul>

      <h2>5. Reminders are a helpful extra, not a guarantee</h2>
      <p>
        We work hard to get reminders right, but we can&rsquo;t promise that every reminder is accurate,
        complete, or delivered on time. Schools change plans, emails can be unclear, automated reading can
        make mistakes, and text messages can be delayed or not delivered by carriers. You remain
        responsible for knowing your children&rsquo;s school schedule. If you spot a wrong reminder, you
        can remove it on the Manage Family page.
      </p>

      <h2>6. Text messages</h2>
      <p>
        Our <Link href="/terms">SMS Terms</Link> are part of these terms. They explain how you opt in,
        how often we text, and how to stop. Reply <strong>STOP</strong> at any time to stop texts to your
        phone, or <strong>HELP</strong> for help. Message and data rates may apply.
      </p>

      <h2>7. Fair use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use {site.name} for anything other than your own family&rsquo;s school reminders;</li>
        <li>sign up other people without their permission, or pretend to be someone else;</li>
        <li>send spam, junk, or harmful files or links to {site.name} addresses or our phone number;</li>
        <li>
          try to get into other families&rsquo; accounts or data, get around our security or limits, or
          overload the Service;
        </li>
        <li>copy, resell, or reverse engineer the Service; or</li>
        <li>use {site.name} in any way that breaks the law.</li>
      </ul>

      <h2>8. Price and payment</h2>
      <p>
        {site.name} is free during the beta. If we start charging, we&rsquo;ll tell you the price and
        terms before anything is charged, and you&rsquo;ll choose whether to subscribe. We won&rsquo;t
        charge you without your agreement. Any paid plan will explain how billing, trials, and
        cancellation work before you sign up for it.
      </p>
      <p>Once paid plans begin, these rules apply:</p>
      <ul>
        <li>
          <strong>Free trial.</strong> New families get a {site.pricing.trialDays}-day free trial. We&rsquo;ll
          text you before it ends. Cancel before the trial ends and you won&rsquo;t be charged.
        </li>
        <li>
          <strong>Renewal.</strong> Paid plans renew automatically (monthly or yearly) until you cancel. We&rsquo;ll
          text you about {site.pricing.renewalReminderDays} days before a yearly plan renews, with the date and
          price.
        </li>
        <li>
          <strong>Canceling.</strong> You can cancel anytime. Your plan won&rsquo;t renew, and you keep{" "}
          {site.name} through the end of the month or year you&rsquo;ve already paid for.
        </li>
        <li>
          <strong>Monthly refunds.</strong> Monthly payments aren&rsquo;t refunded, including partial months.
        </li>
        <li>
          <strong>Yearly refunds.</strong> If you ask within {site.pricing.refundDays} days of being charged for a
          yearly plan (including a renewal), we&rsquo;ll refund the full amount and end your plan. After that,
          yearly payments aren&rsquo;t refunded, but you keep {site.name} until the year ends.
        </li>
        <li>
          <strong>How to ask.</strong> Email {email} with your name and phone number, or ask on the
          Manage Family page once that option is available. Refunds go back to the card you paid with, usually
          within 5 to 10 business days.
        </li>
        <li>
          We may make exceptions in special situations, such as a family that moves mid-year. Nothing here limits
          any refund rights you have under the law.
        </li>
      </ul>

      <h2>9. Stopping or ending the Service</h2>
      <ul>
        <li>
          <strong>You can stop at any time.</strong> Reply STOP to end texts to your phone, leave your
          family, or delete your family and its data on the <Link href="/family">Manage Family</Link> page.
          You can also email {email}.
        </li>
        <li>
          <strong>We may suspend or close an account</strong> that breaks these terms, puts others at
          risk, or that we&rsquo;re required to close by law. Where it&rsquo;s reasonable, we&rsquo;ll tell
          you first.
        </li>
        <li>
          <strong>We may change or end the Service.</strong> If we shut down {site.name}, we&rsquo;ll give
          you reasonable notice by text or email when we can, and refund the unused part of any yearly plan.
        </li>
        <li>
          After an account ends, we delete its data as described in our Privacy Policy. Sections 4, 5, and
          10 through 14 continue to apply after your use ends.
        </li>
      </ul>

      <h2>10. Other services</h2>
      <p>
        {site.name} works alongside services we don&rsquo;t control, including your email provider, your
        school&rsquo;s communication tools, and mobile carriers. We aren&rsquo;t responsible for how those
        services work, change, or fail, such as an email provider that blocks forwarding or a carrier that
        delays a text.
      </p>

      <h2>11. No warranties</h2>
      <p className="caps">
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE FULLEST EXTENT
        THE LAW ALLOWS, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. WE DON&rsquo;T
        PROMISE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY REMINDER WILL BE
        ACCURATE, COMPLETE, OR DELIVERED.
      </p>

      <h2>12. Limits on our liability</h2>
      <p className="caps">
        TO THE FULLEST EXTENT THE LAW ALLOWS, {site.name.toUpperCase()} AND {site.legalName.toUpperCase()}{" "}
        WON&rsquo;T BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
        FOR ANY LOSS ARISING FROM A MISSED, LATE, INCOMPLETE, OR INACCURATE REMINDER. OUR TOTAL LIABILITY
        FOR ANY CLAIM ABOUT THE SERVICE IS LIMITED TO THE GREATER OF THE AMOUNT YOU PAID US IN THE 12
        MONTHS BEFORE THE CLAIM OR $50.
      </p>
      <p>
        Some states don&rsquo;t allow certain warranty disclaimers or liability limits, so some of the
        above may not apply to you. Nothing in these terms limits rights you have that can&rsquo;t be
        waived by law.
      </p>

      <h2>13. If you misuse the Service</h2>
      <p>
        If someone makes a claim against us because you broke these terms or the law while using{" "}
        {site.name}, you agree to cover our reasonable costs of dealing with that claim, including
        reasonable legal fees.
      </p>

      <h2>14. Disagreements</h2>
      <p>
        If you have a problem with {site.name}, please email {email} first. Most issues can be sorted out
        quickly, and we&rsquo;ll try in good faith for at least 30 days before either of us goes further.
        These terms are governed by the laws of the State of {site.governingState}, without regard to its
        conflict-of-law rules. Any dispute that isn&rsquo;t resolved will be handled in the state or federal
        courts located in {site.governingState}, though either of us may use small claims court if the claim
        qualifies.
      </p>

      <h2>15. Changes to these terms</h2>
      <p>
        We may update these terms. We&rsquo;ll change the date at the top, and if a change is significant,
        we&rsquo;ll let you know by text or email before it takes effect. If you keep using {site.name}{" "}
        after a change takes effect, you accept the updated terms. If you don&rsquo;t agree, you can stop
        using the Service at any time.
      </p>

      <h2>16. The rest of the fine print</h2>
      <ul>
        <li>
          These terms, the SMS Terms, and the Privacy Policy are the whole agreement between you and us
          about the Service.
        </li>
        <li>If any part of these terms can&rsquo;t be enforced, the rest still applies.</li>
        <li>If we don&rsquo;t enforce part of these terms right away, we can still enforce it later.</li>
        <li>
          You can&rsquo;t transfer your account or these terms to someone else. We may transfer them, for
          example to a company we form to run {site.name}, and we&rsquo;ll let you know if we do.
        </li>
      </ul>

      <h2>17. Contact</h2>
      <p>
        {site.legalName}, doing business as {site.name}
        <br />
        {site.governingState}
        <br />
        {email}
      </p>
    </article>
  );
}
