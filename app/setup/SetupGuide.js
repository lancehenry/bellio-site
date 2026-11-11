"use client";

import { useEffect, useMemo, useState } from "react";
import CopyField from "../CopyField";
import site from "@/site.config";

const ADDRESS_RE = /^[a-f0-9]{6,12}@inbox\.heybellio\.com$/i;

// Common school communication services. Parents tick the ones their school uses.
const PLATFORMS = [
  { id: "parentsquare", label: "ParentSquare", domain: "@parentsquare.com" },
  { id: "smore", label: "Smore newsletters", domain: "@smore.com" },
  { id: "seesaw", label: "Seesaw", domain: "@seesaw.me" },
  { id: "classdojo", label: "ClassDojo", domain: "@classdojo.com" },
  { id: "remind", label: "Remind", domain: "@remind.com" },
  { id: "konstella", label: "Konstella (PTA)", domain: "@konstella.com" },
  { id: "signupgenius", label: "SignUpGenius", domain: "@signupgenius.com" },
];

const TABS = [
  { id: "gmail", label: "Gmail" },
  { id: "outlook", label: "Outlook / Hotmail" },
  { id: "icloud", label: "iCloud" },
  { id: "other", label: "Other" },
];

function cleanDomain(input) {
  let d = String(input || "").trim().toLowerCase();
  if (!d) return "";
  if (d.includes("@")) d = d.slice(d.lastIndexOf("@") + 1); // "teacher@smsd.org" -> "smsd.org"
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? `@${d}` : "";
}

export default function SetupGuide() {
  const [address, setAddress] = useState("");
  const [tab, setTab] = useState("gmail");
  const [school, setSchool] = useState("");
  const [picked, setPicked] = useState(["parentsquare"]);

  // The signup and join pages link here with ?address=..., so we can fill it in.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("address") || "";
    if (ADDRESS_RE.test(fromLink)) setAddress(fromLink.toLowerCase());
  }, []);

  const senders = useMemo(() => {
    const schoolDomains = school.split(/[,;\s]+/).map(cleanDomain);
    const list = [...schoolDomains, ...PLATFORMS.filter((p) => picked.includes(p.id)).map((p) => p.domain)];
    return [...new Set(list.filter(Boolean))];
  }, [school, picked]);

  const gmailFrom = senders.join(" OR ");
  const bellio = ADDRESS_RE.test(address) ? address : "";
  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <div className="setup-guide">
      {/* Step 1: their Bellio address */}
      <div className="setup-card">
        <h2><span className="step-num">1</span> Your family&rsquo;s Bellio address</h2>
        {bellio ? (
          <CopyField value={bellio} />
        ) : (
          <>
            <p className="hint">
              It&rsquo;s on your signup confirmation and in your welcome text. It looks like{" "}
              <code>ab12cd34@inbox.heybellio.com</code>.
            </p>
            <input
              className="setup-input"
              placeholder="Paste your Bellio address"
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
              aria-label="Your Bellio address"
            />
          </>
        )}
      </div>

      {/* Step 2: which senders count as school email */}
      <div className="setup-card">
        <h2><span className="step-num">2</span> Which emails are from school?</h2>
        <label className="setup-label">
          Your school district&rsquo;s email domain
          <input
            className="setup-input"
            placeholder="e.g. smsd.org, or paste a teacher's email address"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
          <span className="hint">
            Look at a teacher&rsquo;s email address. It&rsquo;s the part after the @. If school
            emails come from more than one domain, separate them with commas.
          </span>
        </label>
        <p className="setup-label">Services your school or PTA uses:</p>
        <div className="chips">
          {PLATFORMS.map((p) => (
            <label key={p.id} className={`chip ${picked.includes(p.id) ? "on" : ""}`}>
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
              {p.label}
            </label>
          ))}
        </div>
        {senders.length > 0 && (
          <p className="hint">
            Forwarding emails from: <strong>{senders.join(", ")}</strong>
          </p>
        )}
      </div>

      {/* Step 3: email-provider steps */}
      <div className="setup-card">
        <h2><span className="step-num">3</span> Set up the rule</h2>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? "on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "gmail" && (
          <div className="tab-body">
            <p className="note">
              Use a computer, or open gmail.com in your phone&rsquo;s browser and switch to the
              desktop version. The Gmail app can&rsquo;t set this up.
            </p>
            <p className="hint">
              Using a work or school Google account? Some organizations block forwarding outside
              the company. If you don&rsquo;t see the forwarding option, use a personal Gmail
              account with your school, or forward by hand (see &ldquo;Other&rdquo;).
            </p>
            <h3>1. Add Bellio as a forwarding address (one time)</h3>
            <ol>
              <li>Click the <strong>gear icon</strong> (top right), then <strong>See all settings</strong>.</li>
              <li>Open the <strong>Forwarding and POP/IMAP</strong> tab and click <strong>Add a forwarding address</strong>.</li>
              <li>Enter your Bellio address{bellio ? "" : " (step 1)"}, then click <strong>Next</strong> and <strong>Proceed</strong>.</li>
              <li>
                Gmail sends a confirmation code to Bellio. <strong>We&rsquo;ll text you the code</strong> within a
                minute. Type it into the <strong>Verify</strong> box and click <strong>Verify</strong>.
              </li>
              <li>
                Leave <strong>&ldquo;Disable forwarding&rdquo;</strong> selected. That way only the school emails
                in the next step go to Bellio, not your whole inbox.
              </li>
            </ol>
            <h3>2. Forward only school emails</h3>
            <ol>
              <li>Open the <strong>Filters and Blocked Addresses</strong> tab and click <strong>Create a new filter</strong>.</li>
              <li>
                In the <strong>From</strong> box, paste:
                {gmailFrom ? <CopyField value={gmailFrom} /> : <span className="hint"> (fill in step 2 to get this)</span>}
              </li>
              <li>Click <strong>Create filter</strong>.</li>
              <li>
                Check <strong>Forward it to</strong>, choose your Bellio address, and click{" "}
                <strong>Create filter</strong>.
              </li>
            </ol>
            <p className="hint">
              For about a week, Gmail shows a notice that you&rsquo;re forwarding some email.
              That&rsquo;s normal. The filter only applies to new emails, so forward any recent
              school emails to Bellio by hand once.
            </p>
          </div>
        )}

        {tab === "outlook" && (
          <div className="tab-body">
            <p className="note">For Outlook.com, Hotmail, and Live addresses, on the web or in the new Outlook app.</p>
            <ol>
              <li>Click the <strong>gear icon</strong> (top right), then go to <strong>Mail &rarr; Rules</strong>.</li>
              <li>Click <strong>Add new rule</strong> and name it &ldquo;Bellio.&rdquo;</li>
              <li>
                For the condition, choose <strong>Sender address includes</strong> (or <strong>From</strong>)
                and add each of these:
                {senders.length ? (
                  <ul className="sender-list">{senders.map((s) => <li key={s}><code>{s}</code></li>)}</ul>
                ) : (
                  <span className="hint"> (fill in step 2 to see them)</span>
                )}
              </li>
              <li>
                For the action, choose <strong>Forward to</strong> and enter your Bellio address
                {bellio ? <CopyField value={bellio} /> : " (step 1)."}
              </li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
            <p className="hint">
              The rule only applies to new emails, so forward any recent school emails to Bellio by
              hand once.
            </p>
            <p className="hint">
              Using a work or school email account? Some employers block forwarding outside the company.
              If the rule won&rsquo;t save or nothing arrives, forward school emails by hand (see
              &ldquo;Other&rdquo;), or use a personal account with your school.
            </p>
          </div>
        )}

        {tab === "icloud" && (
          <div className="tab-body">
            <p className="note">Use a computer or tablet browser at icloud.com/mail.</p>
            <ol>
              <li>Sign in at <strong>icloud.com/mail</strong>.</li>
              <li>Open <strong>Settings</strong> (the gear at the top of the mailbox list), then <strong>Rules</strong>.</li>
              <li>Click <strong>Add a Rule</strong>.</li>
              <li>
                Set <strong>If a message is from</strong> to one of your school senders:
                {senders.length ? (
                  <ul className="sender-list">{senders.map((s) => <li key={s}><code>{s}</code></li>)}</ul>
                ) : (
                  <span className="hint"> (fill in step 2 to see them)</span>
                )}
              </li>
              <li>
                Set <strong>Then</strong> to <strong>Forward to</strong> and enter your Bellio address
                {bellio ? <CopyField value={bellio} /> : " (step 1)."}
              </li>
              <li>Click <strong>Done</strong>. Add one rule for each sender.</li>
            </ol>
            <p className="hint">
              If iCloud won&rsquo;t accept just the part after the @, enter a full address you get
              school emails from instead (for example, your teacher&rsquo;s address).
            </p>
            <p className="hint">
              Don&rsquo;t use iCloud&rsquo;s &ldquo;Mail Forwarding&rdquo; setting. It sends <em>all</em> your
              email, and Bellio only needs school emails.
            </p>
          </div>
        )}

        {tab === "other" && (
          <div className="tab-body">
            <p>No rule needed. These work from any email app, including on your phone:</p>
            <ul>
              <li>
                <strong>Forward by hand:</strong> tap <strong>Forward</strong> on any school email and send it to
                your Bellio address{bellio ? <CopyField value={bellio} /> : " (step 1)."}
                {" "}Tip: save the address as a contact named &ldquo;Bellio.&rdquo;
              </li>
              <li>
                <strong>Paper flyers:</strong> text a photo of the flyer to Bellio at {site.smsNumber}.
              </li>
              <li>
                <strong>Ask the school:</strong> some schools and PTAs let you add a second email address
                to your contact info. Add your Bellio address, and emails come to us directly.
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="setup-card done">
        <h2>Check that it&rsquo;s working</h2>
        <p>
          Next time a school email arrives, Bellio picks out any dates and to-dos, and you&rsquo;ll get a
          text the night before. Questions? Text <strong>HELP</strong> to Bellio or email{" "}
          <a href="mailto:hello@heybellio.com">hello@heybellio.com</a>.
        </p>
      </div>
    </div>
  );
}
