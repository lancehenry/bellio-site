import Link from "next/link";
import site from "@/site.config";

export const metadata = { title: `SMS Terms — ${site.name}` };

export default function Terms() {
  return (
    <article className="container legal">
      <h1>SMS Terms &amp; Conditions</h1>
      <p className="updated">Last updated: {site.lastUpdated}</p>

      <h2>Program description</h2>
      <p>
        The {site.name} text program sends school event reminders to parents
        and guardians who sign up at {site.domain}. Reminders are based on the
        school emails and flyers you send us, for example: &ldquo;Tomorrow (Thu
        11/12): Picture day for Emma. Wear a collared shirt.&rdquo; You may
        also receive account and service messages, such as setup instructions.
      </p>

      <h2>Who can use Bellio</h2>
      <p>
        Bellio is for parents and legal guardians of school-age children. Each
        family account may include up to two adults (for example, two parents
        or co-parents), each of whom must opt in with their own phone number.
        Invite links work once and expire after 7 days. Please don&rsquo;t
        share invite links with anyone other than a parent or guardian. Need
        an exception, such as for a blended family? Email{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h2>How you opt in</h2>
      <p>
        You opt in by entering your mobile number on our signup form and
        checking the box agreeing to receive text messages. Consent is not a
        condition of any purchase.
      </p>

      <h2>Message frequency</h2>
      <p>
        Message frequency varies based on your school&rsquo;s schedule, usually
        one reminder in the evening and sometimes a morning reminder, plus
        occasional account messages and replies to texts you send us.
      </p>

      <h2>Costs</h2>
      <p>
        Message and data rates may apply. Check with your mobile carrier for
        details. Carriers are not liable for delayed or undelivered messages.
      </p>

      <h2>How to opt out</h2>
      <p>
        Text <strong>STOP</strong> to {site.smsNumber} at any time to stop
        receiving messages. You&rsquo;ll receive one final message confirming
        you&rsquo;ve been unsubscribed. To rejoin, sign up again on our website
        or text <strong>START</strong>.
      </p>

      <h2>Help</h2>
      <p>
        Text <strong>HELP</strong> to {site.smsNumber} or email{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h2>Accuracy</h2>
      <p>
        Reminders are created automatically from the content you send and may
        occasionally be incomplete or wrong. Always check the original school
        communication for important dates. To remove a wrong reminder, text{" "}
        <strong>SETTINGS</strong> for a link to your Manage Family page.
      </p>

      <h2>Privacy</h2>
      <p>
        See our <Link href="/privacy">Privacy Policy</Link>. We don&rsquo;t
        share your mobile number or opt-in data with third parties for
        marketing purposes.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms and will post changes on this page. These
        terms are governed by the laws of the State of {site.governingState}.
        These SMS Terms are part of our full{" "}
        <Link href="/terms-of-service">Terms of Service</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        {site.legalName}
        <br />
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
    </article>
  );
}
