import Link from "next/link";
import site from "@/site.config";

export const metadata = {
  title: `FAQ — ${site.name}`,
  description: `Answers to common questions about ${site.name}: setup, texts, accuracy, your account, and privacy.`,
};

// Each answer is opened with a tap (<details>), so the page stays short on a phone.
// Keep these in step with how Bellio actually works when features change.
function sections() {
  const email = <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>;
  const num = site.smsNumber;
  return [
    {
      id: "start",
      title: "Getting started",
      items: [
        {
          q: `What is ${site.name}?`,
          a: (
            <p>
              {site.name} turns school emails and flyers into short text reminders. You send us your
              school&rsquo;s emails, we pick out the dates and to-dos, and we text you the evening before
              anything you need to know or do, like picture day, early release, or a form that&rsquo;s due.
            </p>
          ),
        },
        {
          q: "How much does it cost?",
          a: (
            <p>
              {site.name} is free during the beta. If we start charging later, we&rsquo;ll tell you the
              price first, and you&rsquo;ll choose whether to keep going. We won&rsquo;t charge you without
              your agreement.
            </p>
          ),
        },
        {
          q: "Who can sign up?",
          a: (
            <p>
              Parents and legal guardians of school-age kids, 18 or older, with a US mobile number. Each
              family can have up to 2 adults and up to 8 kids.
            </p>
          ),
        },
        {
          q: "How do I add my co-parent?",
          a: (
            <>
              <p>Send them an invite link. You can get one three ways:</p>
              <ul>
                <li>right after you sign up,</li>
                <li>by texting <strong>INVITE</strong> to {num}, or</li>
                <li>on the <Link href="/family">Manage Family</Link> page.</li>
              </ul>
              <p>
                Each link works once and expires after 7 days. Your co-parent signs up with their own phone
                number and gets the same reminders you do.
              </p>
            </>
          ),
        },
        {
          q: "We live in different houses. Can we still share?",
          a: (
            <p>
              Yes. You can share one family, so you both get every reminder. Or you can each sign up
              separately, with your own Bellio address and your own reminders, if you&rsquo;d rather keep
              things apart.
            </p>
          ),
        },
        {
          q: "Can grandparents or a nanny get the texts too?",
          a: (
            <p>
              Not yet. Each family is limited to 2 adults for now. If you have a special situation, like
              a blended family, email {email} and we&rsquo;ll see what we can do.
            </p>
          ),
        },
      ],
    },
    {
      id: "emails",
      title: "Sending school emails",
      items: [
        {
          q: "How do I send school emails to Bellio?",
          a: (
            <>
              <p>Any of these work, and you can mix them:</p>
              <ul>
                <li>
                  <strong>Set up auto-forwarding</strong> so school emails go to {site.name} on their own.
                  Our <Link href="/setup">2-minute setup guide</Link> walks you through Gmail, Outlook, and
                  iCloud.
                </li>
                <li>
                  <strong>Forward emails by hand</strong> to your family&rsquo;s {site.name} address.
                </li>
                <li>
                  <strong>Text a photo</strong> of a paper flyer (or a screenshot) to {num}.
                </li>
              </ul>
            </>
          ),
        },
        {
          q: "Where do I find my Bellio address?",
          a: (
            <p>
              It&rsquo;s on your signup confirmation, in your welcome text, and at the top of the{" "}
              <Link href="/family">Manage Family</Link> page. It looks like{" "}
              <code>ab12cd34@inbox.heybellio.com</code>. Everyone in your family shares the same address.
            </p>
          ),
        },
        {
          q: "Do my emails stay in my inbox?",
          a: (
            <p>
              Yes. Forwarding sends {site.name} a copy. Your school emails still arrive in your inbox just
              like before.
            </p>
          ),
        },
        {
          q: "Which emails should I forward?",
          a: (
            <p>
              Only emails from your kids&rsquo; schools, teachers, district, PTA, and the apps they use.
              The setup guide helps you forward just those, so your personal email never reaches{" "}
              {site.name}. If you work for the school district, set this up in a personal email account,
              not your work one.
            </p>
          ),
        },
        {
          q: "Our school uses an app like ParentSquare, Seesaw, or Remind. Does that work?",
          a: (
            <p>
              If the app also sends you emails, yes. Add the app in step 2 of the{" "}
              <Link href="/setup">setup guide</Link> and those emails will forward too. If something only
              shows up inside the app, take a screenshot and text it to {num}.
            </p>
          ),
        },
        {
          q: "What about emails I got before I signed up?",
          a: (
            <p>
              Auto-forwarding only sends new emails. Forward any recent school emails by hand once, and{" "}
              {site.name} will pick up anything coming in the next couple of months.
            </p>
          ),
        },
        {
          q: "Gmail asked me for a confirmation code. Where is it?",
          a: (
            <p>
              Gmail sends the code to your {site.name} address, and we text it to you within a minute or
              two. Type it into Gmail to finish turning on forwarding.
            </p>
          ),
        },
        {
          q: "How do I know it's working?",
          a: (
            <p>
              When your first school email reaches {site.name}, we&rsquo;ll text you to confirm. Want to
              check right away? Forward one school email to your {site.name} address.
            </p>
          ),
        },
      ],
    },
    {
      id: "texts",
      title: "Your texts",
      items: [
        {
          q: "When will I get texts?",
          a: (
            <ul>
              <li>
                <strong>The evening before</strong>, usually around 7 or 8pm, for anything happening the
                next day.
              </li>
              <li>
                <strong>Early morning</strong>, only if something for today came in too late for the
                evening text, like a Sunday-night newsletter.
              </li>
              <li>
                <strong>Right away</strong>, if a late email or flyer has something for tomorrow (in the
                evening) or for today (in the morning).
              </li>
            </ul>
          ),
        },
        {
          q: "How many texts will I get?",
          a: (
            <p>
              Usually one short text on evenings when there&rsquo;s something to know, and nothing on quiet
              days. If you have more than one child, each text is grouped by kid. A few days ahead, we also
              send a heads-up for things that need planning, like days off or forms with a deadline.
            </p>
          ),
        },
        {
          q: "What can I text Bellio?",
          a: (
            <ul>
              <li><strong>WEEK</strong>: see what&rsquo;s coming up in the next 7 days</li>
              <li><strong>SETTINGS</strong>: get a link to manage your family</li>
              <li><strong>INVITE</strong>: get a link to add your co-parent</li>
              <li><strong>A photo</strong> of a flyer or screenshot: we&rsquo;ll read it and reply with what we found</li>
              <li><strong>HELP</strong>: get help</li>
              <li><strong>STOP</strong> to stop texts, <strong>START</strong> to turn them back on</li>
            </ul>
          ),
        },
        {
          q: "How do I stop the texts?",
          a: (
            <p>
              Reply <strong>STOP</strong> to any text, or use &ldquo;Stop texts to me&rdquo; on the Manage
              Family page. This only stops texts to your phone. Your co-parent keeps getting theirs. Text{" "}
              <strong>START</strong> to turn them back on.
            </p>
          ),
        },
        {
          q: "Do texts cost anything?",
          a: <p>{site.name} doesn&rsquo;t charge for texts. Your carrier&rsquo;s message and data rates may apply.</p>,
        },
      ],
    },
    {
      id: "accuracy",
      title: "Accuracy",
      items: [
        {
          q: "Can Bellio get something wrong or miss it?",
          a: (
            <p>
              Yes, sometimes. {site.name} uses AI to read school emails, and emails can be unclear or plans
              can change. Think of {site.name} as a helpful extra, and always check the school&rsquo;s
              message for anything important.
            </p>
          ),
        },
        {
          q: "What do I do if a reminder is wrong?",
          a: (
            <p>
              Text <strong>SETTINGS</strong> for a link to your Manage Family page, find it under
              &ldquo;Coming up,&rdquo; and tap <strong>Remove</strong>. {site.name} won&rsquo;t text it,
              and won&rsquo;t add it back if it shows up in another email.
            </p>
          ),
        },
        {
          q: "How does Bellio know which kid a reminder is for?",
          a: (
            <p>
              It uses each child&rsquo;s grade and school. That&rsquo;s why it helps to fill those in on the
              Manage Family page and keep them up to date. Items for grades your kids aren&rsquo;t in are
              skipped.
            </p>
          ),
        },
        {
          q: "Two emails mention the same thing. Will I get two reminders?",
          a: (
            <p>
              No. {site.name} checks new items against what it already has, so the same event from a
              school newsletter and a teacher email only shows up once.
            </p>
          ),
        },
      ],
    },
    {
      id: "account",
      title: "Your account",
      items: [
        {
          q: "How do I change my kids, invite someone, or update my info?",
          a: (
            <p>
              Use the <Link href="/family">Manage Family</Link> page. Text <strong>SETTINGS</strong> to{" "}
              {num}, or enter your number on that page, and we&rsquo;ll text you a one-time sign-in link. No
              password needed.
            </p>
          ),
        },
        {
          q: "I got a new phone number. What do I do?",
          a: (
            <p>
              Sign in to Manage Family and choose &ldquo;Change number.&rdquo; We&rsquo;ll text a code to
              your new number to confirm it. If you no longer have your old number and can&rsquo;t sign in,
              email {email}.
            </p>
          ),
        },
        {
          q: "My child changed schools. What should I update?",
          a: (
            <p>
              Update your child&rsquo;s school on the Manage Family page. If the new school is in a
              different district or uses a different app, update your email forwarding rule too. The{" "}
              <Link href="/setup">setup guide</Link> has a &ldquo;Changing schools or senders later?&rdquo;
              section that shows how.
            </p>
          ),
        },
        {
          q: "How do I leave or delete my account?",
          a: (
            <p>
              On the Manage Family page, a co-parent can leave the family at any time. The person who set up
              the family can delete it, which erases its kids, emails, and reminders right away. You can also
              email {email} and we&rsquo;ll do it for you.
            </p>
          ),
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      items: [
        {
          q: "Does Bellio read all my email?",
          a: (
            <p>
              No. {site.name} only sees emails that you forward to it. We never get access to your inbox.
            </p>
          ),
        },
        {
          q: "What happens to the emails I send?",
          a: (
            <p>
              We read them to pull out dates and to-dos, then erase their contents within about a day. The
              reminders themselves are deleted 30 days after their date. We use trusted service providers,
              including an AI service, only to run {site.name}. See our{" "}
              <Link href="/privacy">Privacy Policy</Link> for details.
            </p>
          ),
        },
        {
          q: "Is my information used to train AI?",
          a: (
            <p>
              No. {site.name} uses Claude by Anthropic to read your school emails. Under our business
              agreement, Anthropic doesn&rsquo;t use your content to train its AI, and it deletes what we
              send within 30 days. We don&rsquo;t use it to train AI either, and it&rsquo;s never shared
              with or searchable by anyone else.
            </p>
          ),
        },
        {
          q: "What do you know about my kids?",
          a: (
            <p>
              Only what you give us: first name, and grade and school if you add them. We never use it for
              advertising, and we never sell your information.
            </p>
          ),
        },
      ],
    },
  ];
}

export default function Faq() {
  const all = sections();
  return (
    <section className="container faq">
      <p className="eyebrow">Help</p>
      <h1>Frequently asked questions</h1>
      <p className="lede">
        Quick answers about setting up {site.name}, your texts, and your account. Don&rsquo;t see your
        question? Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> or text{" "}
        <strong>HELP</strong> to {site.smsNumber}.
      </p>

      <nav className="faq-topics" aria-label="FAQ topics">
        {all.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="chip">
            {s.title}
          </a>
        ))}
      </nav>

      {all.map((s) => (
        <div key={s.id} id={s.id} className="faq-section">
          <h2>{s.title}</h2>
          {s.items.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </div>
      ))}

      <div className="setup-card faq-more">
        <h2>Still stuck?</h2>
        <p>
          Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>. During the beta, a real
          person (the person who built {site.name}) reads every message.
        </p>
        <p>
          <Link href="/setup">Open the setup guide</Link> &middot; <Link href="/family">Manage your family</Link>
        </p>
      </div>
    </section>
  );
}
