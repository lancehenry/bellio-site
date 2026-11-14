"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import site from "@/site.config";
import CopyField from "../CopyField";
import BotCheck, { botCheckFields, resetBotCheck } from "../BotCheck";

async function api(method, body) {
  const res = await fetch("/api/family", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return { signedOut: true };
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function FamilyPage() {
  const [state, setState] = useState("loading"); // loading | signedOut | ready | done
  const [family, setFamily] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    api("GET")
      .then((data) => {
        if (data.signedOut) setState("signedOut");
        else {
          setFamily(data);
          setState("ready");
        }
      })
      .catch(() => setState("signedOut"));
  }, []);

  // Runs an action, refreshes the page data, and shows any error.
  async function act(body, successNote = "") {
    setError("");
    setNotice("");
    try {
      const data = await api("POST", body);
      if (data.signedOut) return setState("signedOut");
      if (data.left || data.deleted) {
        setNotice(data.deleted ? "Your family and its data have been deleted." : "You've left the family.");
        return setState("done");
      }
      if (data.inviteUrl) setInvite({ url: data.inviteUrl, days: data.inviteDays });
      setFamily(data);
      if (successNote) setNotice(successNote);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  if (state === "loading") return <section className="container family"><p className="hint">Loading…</p></section>;
  if (state === "signedOut") return <SignIn />;
  if (state === "done") {
    return (
      <section className="container family">
        <div className="form-card">
          <h1>All set</h1>
          <p>{notice}</p>
          <Link href="/">Back to {site.name}</Link>
        </div>
      </section>
    );
  }

  const { me, kids, adults, maxAdults, maxKids } = family;
  const isOwner = me.role === "owner";
  const others = adults.filter((a) => !a.isMe);
  const setupUrl = `/setup?address=${encodeURIComponent(family.forwardingAddress)}`;

  return (
    <section className="container family">
      <div className="family-head">
        <div>
          <p className="eyebrow">Manage family</p>
          <h1>Hi, {me.firstName}</h1>
        </div>
        <button
          className="link-btn"
          onClick={() => api("POST", { action: "signOut" }).finally(() => setState("signedOut"))}
        >
          Sign out
        </button>
      </div>

      {error && <p className="form-error banner" role="alert">{error}</p>}
      {notice && <p className="notice banner" role="status">{notice}</p>}

      <div className="setup-card">
        <h2>Your family&rsquo;s Bellio address</h2>
        <CopyField value={family.forwardingAddress} />
        <p className="hint">
          Forward school emails here, or <Link href={setupUrl}>set up auto-forwarding</Link>.
        </p>
      </div>

      <Upcoming items={family.upcoming || []} onRemove={act} />

      <div className="setup-card">
        <h2>Kids</h2>
        <p className="hint">Grade (like K or 4th) and school help Bellio match each reminder to the right kid.</p>
        {kids.length >= 2 && kids.some((k) => !k.grade || !k.school) && (
          <p className="notice kid-nudge" role="status">
            Add a grade and school for{" "}
            {listNames(kids.filter((k) => !k.grade || !k.school).map((k) => k.firstName))} so reminders go to the
            right kid.
          </p>
        )}
        <ul className="row-list">
          {kids.map((k) => (
            <KidRow
              key={k.id}
              kid={k}
              canRemove={kids.length > 1}
              needsDetails={kids.length >= 2}
              onSave={act}
              setupUrl={setupUrl}
            />
          ))}
        </ul>
        {kids.length < maxKids && <AddKid onAdd={act} needsDetails={kids.length >= 1} />}
      </div>

      <div className="setup-card">
        <h2>Adults</h2>
        <ul className="row-list">
          {adults.map((a) => (
            <li key={a.id} className="row">
              <div>
                <strong>{a.firstName}</strong>{a.isMe && " (you)"}
                <div className="hint">
                  {a.role === "owner" ? "Set up the family" : "Co-parent"} · phone ending {a.phoneEnd} ·{" "}
                  {a.textsOn ? "gets texts" : "texts off"}
                </div>
              </div>
              {isOwner && !a.isMe && (
                <button
                  className="link-btn danger"
                  onClick={() =>
                    window.confirm(`Remove ${a.firstName} from your family? They'll stop getting reminders right away.`) &&
                    act({ action: "removeMember", memberId: a.id }, `${a.firstName} was removed.`)
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {adults.length < maxAdults ? (
          invite ? (
            <div className="invite-box">
              <p className="hint">
                Send this link to your co-parent. It works once and expires in {invite.days} days.
              </p>
              <CopyField value={invite.url} label="Copy link" />
            </div>
          ) : (
            <button className="btn-secondary" onClick={() => act({ action: "newInvite" })}>
              Invite a co-parent
            </button>
          )
        ) : (
          <p className="hint">Your family has {maxAdults} adults, the most allowed.</p>
        )}
      </div>

      <div className="setup-card">
        <h2>Your texts</h2>
        <PhoneNumber me={me} pendingEnd={family.pendingPhoneEnd} onAct={act} />
        {me.textsOn ? (
          <>
            <p className="hint">Text <strong>WEEK</strong> to {site.smsNumber} anytime to see the next 7 days.</p>
            <button
              className="link-btn danger"
              onClick={() =>
                window.confirm("Stop Bellio texts to your phone? Others in your family will still get them.") &&
                act({ action: "stopTexts" }, "Texts to you are off.")
              }
            >
              Stop texts to me
            </button>
          </>
        ) : (
          <p className="hint">
            Texts to you are off. To turn them back on, text <strong>START</strong> to {site.smsNumber}.
          </p>
        )}
      </div>

      <div className="setup-card danger-zone">
        <h2>Leave or delete</h2>
        {(!isOwner || others.length > 0) && (
          <div className="danger-row">
            <p className="hint">
              {isOwner
                ? `Leave the family. ${others[0]?.firstName} will take over managing it.`
                : "Leave this family. You'll stop getting its reminders."}
            </p>
            <button
              className="link-btn danger"
              onClick={() => window.confirm("Leave this family?") && act({ action: "leaveFamily" })}
            >
              Leave family
            </button>
          </div>
        )}
        {isOwner && <DeleteFamily onDelete={act} />}
      </div>
    </section>
  );
}

function Upcoming({ items, onRemove }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, 8);
  const days = [];
  for (const i of shown) {
    if (days.at(-1)?.day !== i.day) days.push({ day: i.day, items: [] });
    days.at(-1).items.push(i);
  }
  return (
    <div className="setup-card">
      <h2>Coming up</h2>
      {items.length === 0 ? (
        <p className="hint">Nothing in the next 30 days yet. Reminders from your school emails show up here.</p>
      ) : (
        <>
          <p className="hint">The next 30 days. See something wrong? Remove it and {site.name} won&rsquo;t text it.</p>
          <div className="upcoming">
            {days.map((d) => (
              <div key={d.day} className="upcoming-day">
                <h3>{d.day}</h3>
                <ul className="row-list">
                  {d.items.map((i) => (
                    <li key={i.id} className={`row${i.headsUp ? " heads-up" : ""}`}>
                      <div>
                        <strong>{i.title}</strong>
                        {i.who && <span className="who"> {i.who}</span>}
                        {(i.action || i.texted) && (
                          <div className="hint">
                            {i.action}
                            {i.action && i.texted ? " · " : ""}
                            {i.texted ? "already texted" : ""}
                          </div>
                        )}
                      </div>
                      <button
                        className="link-btn danger"
                        aria-label={`Remove ${i.title}`}
                        onClick={() =>
                          window.confirm(`Remove "${i.title}"? ${site.name} won't text it, even if it shows up in another email.`) &&
                          onRemove({ action: "dismissEvent", eventId: i.id }, "Removed. It won\u2019t be texted.")
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {items.length > 8 && (
            <button className="link-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PhoneNumber({ me, pendingEnd, onAct }) {
  const [step, setStep] = useState(pendingEnd ? "code" : "idle"); // idle | enter | code
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body, note) => {
    setBusy(true);
    const ok = await onAct(body, note);
    setBusy(false);
    return ok;
  };

  if (step === "idle") {
    return (
      <p className="hint">
        Texts go to your phone ending in <strong>{me.phoneEnd}</strong>.{" "}
        <button className="link-btn" onClick={() => setStep("enter")}>Change number</button>
      </p>
    );
  }

  if (step === "enter") {
    return (
      <div className="phone-change">
        <label className="setup-label">
          New mobile number
          <input
            className="setup-input"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 555-5555"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="consent-line">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I agree to get {site.name} reminder texts at this number. Msg frequency varies. Msg &amp; data rates may
            apply. Reply STOP to cancel, HELP for help.
          </span>
        </label>
        <div className="row-actions">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={async () => {
              if (await run({ action: "startPhoneChange", phone, consent }, "We texted a 6-digit code to your new number.")) {
                setStep("code");
              }
            }}
          >
            {busy ? "Sending…" : "Text me a code"}
          </button>
          <button className="link-btn" onClick={() => setStep("idle")}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-change">
      <label className="setup-label">
        Enter the 6-digit code we texted{pendingEnd ? ` to the number ending in ${pendingEnd}` : ""}
        <input
          className="setup-input code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <div className="row-actions">
        <button
          className="btn-secondary"
          disabled={busy || code.length !== 6}
          onClick={async () => {
            if (await run({ action: "confirmPhoneChange", code }, "Your number is updated. Texts now go to your new phone.")) {
              setStep("idle");
              setCode("");
            }
          }}
        >
          {busy ? "Checking…" : "Confirm"}
        </button>
        <button
          className="link-btn"
          onClick={() => {
            onAct({ action: "cancelPhoneChange" });
            setStep("idle");
            setCode("");
          }}
        >
          Cancel
        </button>
      </div>
      <p className="hint">The code expires in 10 minutes. Didn&rsquo;t get it? Cancel and try again.</p>
    </div>
  );
}

function listNames(names) {
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function KidRow({ kid, canRemove, needsDetails, onSave, setupUrl }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(kid);
  const missing = needsDetails && (!kid.grade || !kid.school);
  if (!editing) {
    return (
      <li className={`row${missing ? " needs-info" : ""}`}>
        <div>
          <strong>{kid.firstName}</strong>
          <div className="hint">{[kid.grade && `Grade ${kid.grade}`, kid.school].filter(Boolean).join(" · ") || "No grade or school yet"}</div>
        </div>
        <div className="row-actions">
          <button className="link-btn" onClick={() => { setForm(kid); setEditing(true); }}>
            {missing ? "Add grade & school" : "Edit"}
          </button>
          {canRemove && (
            <button
              className="link-btn danger"
              onClick={() =>
                window.confirm(`Remove ${kid.firstName}? Reminders just for ${kid.firstName} will be deleted.`) &&
                onSave({ action: "removeKid", kidId: kid.id }, `${kid.firstName} was removed.`)
              }
            >
              Remove
            </button>
          )}
        </div>
      </li>
    );
  }
  return (
    <li className="row editing">
      <KidFields form={form} setForm={setForm} required={needsDetails} />
      <div className="row-actions">
        <button
          className="btn-secondary"
          onClick={async () => {
            // Only when an existing school changes, not when one is filled in for the first time.
            const newSchool = !!(kid.school || "").trim() && (form.school || "").trim().toLowerCase() !== (kid.school || "").trim().toLowerCase();
            const note = newSchool ? (
              <>
                Saved. Changed schools? <Link href={setupUrl}>Update your email rule</Link> so the new
                school&rsquo;s emails reach {site.name}.
              </>
            ) : (
              "Saved."
            );
            if (await onSave({ action: "updateKid", kidId: kid.id, kid: form }, note)) setEditing(false);
          }}
        >
          Save
        </button>
        <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </li>
  );
}

function AddKid({ onAdd, needsDetails }) {
  const empty = { firstName: "", grade: "", school: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  if (!open) return <button className="add-kid" onClick={() => setOpen(true)}>+ Add a child</button>;
  return (
    <div className="row editing">
      <KidFields form={form} setForm={setForm} required={needsDetails} />
      <div className="row-actions">
        <button
          className="btn-secondary"
          onClick={async () => {
            if (await onAdd({ action: "addKid", kid: form }, `${form.firstName} was added.`)) {
              setForm(empty);
              setOpen(false);
            }
          }}
        >
          Add
        </button>
        <button className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function KidFields({ form, setForm, required }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <div className="kid-row">
        <input aria-label="First name" placeholder="First name" value={form.firstName || ""} onChange={set("firstName")} />
        <input
          aria-label="Grade"
          placeholder="Grade"
          value={form.grade || ""}
          onChange={set("grade")}
          aria-required={required || undefined}
        />
        <input
          aria-label="School"
          placeholder={required ? "School or daycare" : "School (optional)"}
          value={form.school || ""}
          onChange={set("school")}
          aria-required={required || undefined}
        />
      </div>
      {required && (
        <p className="hint">With more than one child, grade and school are needed so we know whose reminder is whose.</p>
      )}
    </>
  );
}

function DeleteFamily({ onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  if (!open) {
    return (
      <div className="danger-row">
        <p className="hint">Delete the family and all of its data now. This can&rsquo;t be undone.</p>
        <button className="link-btn danger" onClick={() => setOpen(true)}>Delete family</button>
      </div>
    );
  }
  return (
    <div className="danger-confirm">
      <p>
        This erases your family&rsquo;s kids, adults, emails, reminders, and invite links right away,
        and everyone stops getting texts. Type <strong>DELETE</strong> to confirm.
      </p>
      <input className="setup-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
      <div className="row-actions">
        <button
          className="btn danger-btn"
          disabled={confirm.trim().toUpperCase() !== "DELETE"}
          onClick={() => onDelete({ action: "deleteFamily", confirm })}
        >
          Delete everything
        </button>
        <button className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function SignIn() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/family/login-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone, ...botCheckFields(data) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setMessage(body.message);
      setStatus("sent");
    } catch (err) {
      setError(err.message);
      setStatus("error");
      resetBotCheck();
    }
  }

  return (
    <section className="container family">
      <form className="form-card family-login" onSubmit={onSubmit}>
        <h1>Manage your family</h1>
        <p className="hint">
          Add or edit kids, invite or remove a co-parent, or stop texts. We&rsquo;ll text you a
          one-time sign-in link. No password needed.
        </p>
        {status === "sent" ? (
          <p className="notice" role="status">{message}</p>
        ) : (
          <>
            <label>
              Your mobile number
              <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required />
            </label>
            <BotCheck />
            <button className="btn" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Text me a link"}
            </button>
          </>
        )}
        {status === "error" && <p className="form-error" role="alert">{error}</p>}
        <p className="hint">
          Or text <strong>SETTINGS</strong> to {site.smsNumber} for a link.
        </p>
      </form>
    </section>
  );
}
