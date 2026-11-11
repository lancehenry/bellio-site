import site from "@/site.config";

export const metadata = { title: `Privacy Policy — ${site.name}` };

export default function Privacy() {
  return (
    <article className="container legal">
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: {site.lastUpdated}</p>

      <p>
        {site.name} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) helps parents keep
        track of school events by turning school emails and flyers into text
        reminders. This policy explains what we collect, how we use it, and the
        choices you have. It applies to {site.domain} and the {site.name}{" "}
        text message service.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, and
          mobile phone number.
        </li>
        <li>
          <strong>Your children&rsquo;s basic details:</strong> first name,
          grade, and school, if you choose to add them, so reminders go to the
          right person.
        </li>
        <li>
          <strong>Family members:</strong> if you invite a co-parent, they
          join your family with their own name and phone number. Everyone in
          a family receives the same reminders and can see the same
          children&rsquo;s names and school events. Each person controls their
          own text messages and can reply STOP at any time.
        </li>
        <li>
          <strong>Content you send us:</strong> school emails you forward,
          their attachments, and photos of flyers you text us.
        </li>
        <li>
          <strong>Message records:</strong> the texts we send you and your
          replies (for example STOP, HELP, or corrections).
        </li>
        <li>
          <strong>Consent records:</strong> when and how you agreed to receive
          text messages.
        </li>
        <li>
          <strong>Payment details:</strong> if you subscribe, payments are
          handled by our payment processor. We don&rsquo;t store your full
          card number.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To read the content you send and identify dates and to-dos.</li>
        <li>To send you reminder texts and respond to your messages.</li>
        <li>To manage your account and subscription.</li>
        <li>To fix problems and improve the accuracy of reminders.</li>
      </ul>
      <p>
        We use AI services to process the emails and flyers you send so we can
        extract events. We only send that content to these services to provide
        {" "}{site.name} to you.
      </p>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>We don&rsquo;t sell your personal information.</li>
        <li>
          <strong>
            We don&rsquo;t share your mobile number or text messaging opt-in
            data with third parties or affiliates for their marketing or
            promotional purposes.
          </strong>
        </li>
        <li>We don&rsquo;t use your children&rsquo;s information for advertising.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share information only with service providers that help us run{" "}
        {site.name}, such as our hosting, database, email-receiving, AI
        processing, text messaging, bot protection, and payment providers. They may use it
        only to provide their services to us. We may also disclose information
        if required by law.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep as little as we can, for as short a time as we can. Deletion
        happens automatically every day:
      </p>
      <ul>
        <li>
          <strong>Forwarded emails and flyer photos:</strong> the contents are
          erased from our database about a day after we&rsquo;ve read them,
          and within 7 days at most. A bare record that an email arrived is
          deleted after 30 days. Our email provider, Postmark, also keeps a
          copy of incoming emails for up to 45 days for spam and abuse
          prevention, then deletes it.
        </li>
        <li>
          <strong>Reminders (dates and to-dos):</strong> deleted 30 days after
          the date has passed.
        </li>
        <li>
          <strong>Text message logs:</strong> deleted after 90 days.
        </li>
        <li>
          <strong>Your account</strong> (family members, children&rsquo;s first
          names, and everything above): deleted 30 days after you cancel.
        </li>
        <li>
          <strong>Opt-in and opt-out records:</strong> kept for 4 years, even
          after your account is deleted, as required to show that you agreed to
          receive texts. These hold only your phone number, the date, and
          whether you opted in or out.
        </li>
      </ul>
      <p>
        You can delete your family and all of its data yourself at any time
        on the Manage Family page (text SETTINGS to us for a sign-in link), or
        ask us to do it.
      </p>

      <h2>Signing in and cookies</h2>
      <p>
        To use the Manage Family page, we text you a one-time sign-in link that
        expires after 15 minutes. Signing in sets one cookie that keeps you
        signed in on that device for 7 days. We don&rsquo;t use advertising or
        tracking cookies. Each sign-in link is stored only in scrambled
        (hashed) form and deleted within a day.
      </p>

      <h2>Bot and abuse protection</h2>
      <p>
        To keep out automated signups, we use Cloudflare Turnstile on our forms
        and limit how often forms can be submitted. Turnstile may process
        technical information about your browser and connection under{" "}
        <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare&rsquo;s privacy policy</a>.
        For rate limiting we store a scrambled (hashed) version of your IP
        address and phone number for no more than 2 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Reply STOP to any text to stop receiving messages.</li>
        <li>
          Email{" "}
          <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> to
          access, correct, or delete your information, including anything about
          your children.
        </li>
      </ul>

      <h2>Children&rsquo;s privacy</h2>
      <p>
        {site.name} is for parents and guardians, not children. We don&rsquo;t
        knowingly collect information directly from children under 13. Any
        information about children comes from their parent or guardian, who
        can review or delete it at any time.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable safeguards to protect your information, but no
        method of storage or transmission is 100% secure.
      </p>

      <h2>Changes</h2>
      <p>
        If we make material changes, we&rsquo;ll update this page and the date
        above, and notify you if the changes affect how we use your
        information.
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
