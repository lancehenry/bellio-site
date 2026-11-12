"use client";

import { useEffect, useRef, useState } from "react";
import CopyField from "../CopyField";
import site from "@/site.config";
import { readSenders } from "./senders";

const ADDRESS_RE = /^[a-f0-9]{6,12}@inbox\.heybellio\.com$/i;

// Common school communication services. Optional: parents open this list only if they need it.
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

export default function SetupGuide() {
  const [address, setAddress] = useState("");
  const [tab, setTab] = useState("gmail");
  const [boxes, setBoxes] = useState([""]);
  const [picked, setPicked] = useState([]);
  const [problems, setProblems] = useState([]);
  const [senders, setSenders] = useState(null); // null until they click Next
  const [personal, setPersonal] = useState([]);
  const [skipped, setSkipped] = useState(false); // chose "Other" without filling in step 2
  const [finished, setFinished] = useState(false);
  const [addressError, setAddressError] = useState("");
  const step1 = useRef(null);
  const step3 = useRef(null);
  const doneCard = useRef(null);

  // The signup, join, and family pages link here with ?address=..., so we can fill it in.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("address") || "";
    if (ADDRESS_RE.test(fromLink)) setAddress(fromLink.toLowerCase());
  }, []);

  useEffect(() => {
    if (finished) doneCard.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [finished]);

  const bellio = ADDRESS_RE.test(address) ? address : "";
  const list = senders || [];
  const gmailFrom = list.join(" OR ");
  const showSteps = senders !== null || skipped;
  const toggle = (id) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const setBox = (i, v) => setBoxes((b) => b.map((x, j) => (j === i ? v : x)));

  // Steps 3 and the finish need the Bellio address, so check it before moving on.
  function addressReady() {
    if (bellio) return true;
    setAddressError(
      address.trim()
        ? "That doesn\u2019t look like a Bellio address. It ends in @inbox.heybellio.com, like ab12cd34@inbox.heybellio.com."
        : `Add your Bellio address first. It\u2019s on your signup confirmation and in your welcome text, or text SETTINGS to ${site.smsNumber} for a link to it.`
    );
    requestAnimationFrame(() => {
      step1.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      step1.current?.querySelector("input")?.focus({ preventScroll: true });
    });
    return false;
  }

  function finish() {
    if (addressReady()) setFinished(true);
  }

  function next() {
    const read = readSenders(boxes);
    const apps = PLATFORMS.filter((p) => picked.includes(p.id)).map((p) => p.domain);
    const all = [...new Set([...read.senders, ...apps])];
    if (read.problems.length) return setProblems(read.problems);
    if (!all.length) return setProblems(["Paste the address of one school email to continue."]);
    setProblems([]);
    if (!addressReady()) return;
    setSenders(all);
    setPersonal(read.personal);
    setFinished(false);
    requestAnimationFrame(() => step3.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function removeSender(s) {
    const left = list.filter((x) => x !== s);
    setPicked((l) => l.filter((id) => PLATFORMS.find((p) => p.id === id)?.domain !== s));
    // Keep the boxes in step with the tags, so "Add or change senders" shows what's left.
    const appDomains = PLATFORMS.map((p) => p.domain);
    const typed = left.filter((x) => !appDomains.includes(x));
    setBoxes(typed.length ? typed : [""]);
    setSenders(left.length ? left : null);
    setPersonal((l) => l.filter((x) => x !== s));
  }

  function edit() {
    setSenders(null);
    setFinished(false);
  }

  return (
    <div className="setup-guide">
      {/* Step 1: their Bellio address */}
      <div className="setup-card" ref={step1}>
        <h2><span className="step-num">1</span> Your family&rsquo;s Bellio address</h2>
        {bellio ? (
          <>
            <CopyField value={bellio} />
            <button type="button" className="link-btn" onClick={() => { setAddress(""); setFinished(false); }}>
              Not your address? Change it
            </button>
          </>
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
              onChange={(e) => {
                setAddress(e.target.value.trim().toLowerCase());
                setAddressError("");
              }}
              aria-label="Your Bellio address"
              aria-invalid={addressError ? true : undefined}
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {addressError && <p className="form-error" role="alert">{addressError}</p>}
          </>
        )}
      </div>

      {/* Step 2: who sends their school emails */}
      <div className="setup-card">
        <h2><span className="step-num">2</span> Who sends your school emails?</h2>
        <p className="hint">So only school emails go to {site.name}, never your personal mail.</p>

        {senders ? (
          <>
            <p className="setup-label">Got it. {site.name} will get emails from:</p>
            <ul className="sender-tags">
              {senders.map((s) => (
                <li key={s} className="sender-tag">
                  <code>{s}</code>
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => removeSender(s)}>&times;</button>
                </li>
              ))}
            </ul>
            {personal.length > 0 && (
              <p className="hint">
                We kept the full address for {personal.join(", ")}, so the rule doesn&rsquo;t catch all
                your other {personal.length > 1 ? "personal" : personal[0].split("@")[1]} email.
              </p>
            )}
            {senders.some((x) => x.startsWith("@") && !PLATFORMS.some((p) => p.domain === x)) && (
              <p className="hint">
                A whole-school sender like{" "}
                <code>{senders.find((x) => x.startsWith("@") && !PLATFORMS.some((p) => p.domain === x))}</code>{" "}
                includes everything that school emails you, like grade or nurse notes. {site.name} only
                keeps the dates and to-dos, and erases the rest within a day.
              </p>
            )}
            <button type="button" className="link-btn" onClick={edit}>Add or change senders</button>
          </>
        ) : (
          <>
            <p className="setup-label">
              Open any email from your school or a teacher and paste the sender&rsquo;s address.
            </p>
            {boxes.map((b, i) => (
              <input
                key={i}
                className="setup-input"
                type="text"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. mrs.smith@usd229.org"
                aria-label={i ? `Another school sender ${i + 1}` : "School email address"}
                value={b}
                onChange={(e) => setBox(i, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
              />
            ))}
            <button type="button" className="link-btn add-sender" onClick={() => setBoxes((b) => [...b, ""])}>
              + Add another sender
            </button>
            <p className="hint">
              One address covers everyone at that school. Add another if emails also come from your
              district or a different school.
            </p>
            <p className="hint">
              <strong>Work for the school district?</strong> Set this up in a personal email account, not
              your work one, so your work email isn&rsquo;t forwarded. Or forward school emails by hand.
            </p>

            <details className="apps">
              <summary>
                Does your school also send through an app like ParentSquare or Remind? (optional)
                {picked.length > 0 && <strong> {picked.length} picked</strong>}
              </summary>
              <div className="chips">
                {PLATFORMS.map((p) => (
                  <label key={p.id} className={`chip ${picked.includes(p.id) ? "on" : ""}`}>
                    <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </details>

            {problems.length > 0 && (
              <div role="alert">
                {problems.map((p) => <p key={p} className="form-error">{p}</p>)}
              </div>
            )}
            <button type="button" className="btn setup-next" onClick={next}>Next</button>
          </>
        )}
      </div>

      {/* Step 3: email-provider steps */}
      <div className="setup-card" ref={step3}>
        <h2><span className="step-num">3</span> Set up the rule</h2>
        {!showSteps ? (
          <p className="hint">
            Finish step 2 to see your steps.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSkipped(true);
                setTab("other");
              }}
            >
              Rather not set up a rule? See other ways
            </button>
          </p>
        ) : (
        <>
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
              <strong>Shortcut:</strong> open a school email, click the <strong>&#8942;</strong> menu at the
              top, then <strong>Filter messages like these</strong>. Gmail fills in the sender. Click{" "}
              <strong>Create filter</strong>, check <strong>Forward it to</strong>, and choose your Bellio
              address. Repeat for each school sender.
            </p>
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
                {list.length ? (
                  <ul className="sender-list">{list.map((s) => <li key={s}><code>{s}</code></li>)}</ul>
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
              <strong>Shortcut in the new Outlook app:</strong> right-click a school email, choose{" "}
              <strong>Rules &rarr; Create rule</strong>, then <strong>More options</strong> to add{" "}
              <strong>Forward to</strong> with your Bellio address.
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
                {list.length ? (
                  <ul className="sender-list">{list.map((s) => <li key={s}><code>{s}</code></li>)}</ul>
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

        <details className="apps change-later">
          <summary>Changing schools or senders later?</summary>
          <div className="tab-body">
            <p>
              Your rule lives in your email account, so you change it there. Come back to this page to
              make the new sender list, then:
            </p>
            <ul>
              <li>
                <strong>Gmail:</strong> gear icon &rarr; <strong>See all settings</strong> &rarr;{" "}
                <strong>Filters and Blocked Addresses</strong>. Click <strong>edit</strong> next to your
                Bellio filter, replace the <strong>From</strong> box, then <strong>Continue</strong> and{" "}
                <strong>Update filter</strong>. Or click <strong>delete</strong> to stop forwarding.
              </li>
              <li>
                <strong>Outlook:</strong> gear icon &rarr; <strong>Mail &rarr; Rules</strong>. Click the
                pencil next to &ldquo;Bellio&rdquo; to change the senders, or the trash can to delete it.
              </li>
              <li>
                <strong>iCloud:</strong> <strong>Settings &rarr; Rules</strong>. Select a Bellio rule to
                change or delete it. Each sender has its own rule.
              </li>
            </ul>
            <p>
              Moved to a new school? Also update each child&rsquo;s school on the{" "}
              <a href="/family">Manage Family</a> page, so reminders go to the right kid.
            </p>
          </div>
        </details>

        <div className="setup-finish">
          <button type="button" className="btn" onClick={finish}>
            {tab === "other" ? "Got it" : "I\u2019ve set up my rule"}
          </button>
          <p className="hint">
            Stuck? See the <a href="/faq">FAQ</a>, text <strong>HELP</strong> to {site.smsNumber}, or email{" "}
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
          </p>
        </div>
        </>
        )}
      </div>

      {finished && (
        <div className="setup-card all-set" ref={doneCard} role="status">
          <h2>You&rsquo;re all set</h2>
          <ul>
            <li>Your school emails keep arriving in your inbox as usual. {site.name} gets a copy.</li>
            <li>The night before anything you need to know or do, you&rsquo;ll get a text.</li>
            <li>When your first school email reaches {site.name}, we&rsquo;ll text you to confirm it&rsquo;s working.</li>
            <li>
              Want to check now? Forward one school email to your Bellio address
              {bellio ? <CopyField value={bellio} /> : "."}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
