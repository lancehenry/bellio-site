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
        processing, text messaging, and payment providers. They may use it
        only to provide their services to us. We may also disclose information
        if required by law.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep forwarded emails and extracted events only as long as needed to
        send your reminders and show where each one came from. You can delete
        your account and data at any time.
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
