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
          Forward school emails here, or <Link href={`/setup?address=${encodeURIComponent(family.forwardingAddress)}`}>set up auto-forwarding</Link>.
        </p>
      </div>

      <div className="setup-card">
        <h2>Kids</h2>
        <p className="hint">Grade and school help Bellio match each reminder to the right kid.</p>
        <ul className="row-list">
          {kids.map((k) => (
            <KidRow key={k.id} kid={k} canRemove={kids.length > 1} onSave={act} />
          ))}
        </ul>
        {kids.length < maxKids && <AddKid onAdd={act} />}
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
        {me.textsOn ? (
          <>
            <p className="hint">You get Bellio&rsquo;s reminder texts at the number you signed up with.</p>
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

function KidRow({ kid, canRemove, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(kid);
  if (!editing) {
    return (
      <li className="row">
        <div>
          <strong>{kid.firstName}</strong>
          <div className="hint">{[kid.grade && `Grade ${kid.grade}`, kid.school].filter(Boolean).join(" · ") || "No grade or school yet"}</div>
        </div>
        <div className="row-actions">
          <button className="link-btn" onClick={() => { setForm(kid); setEditing(true); }}>Edit</button>
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
      <KidFields form={form} setForm={setForm} />
      <div className="row-actions">
        <button
          className="btn-secondary"
          onClick={async () => (await onSave({ action: "updateKid", kidId: kid.id, kid: form }, "Saved.")) && setEditing(false)}
        >
          Save
        </button>
        <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </li>
  );
}

function AddKid({ onAdd }) {
  const empty = { firstName: "", grade: "", school: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  if (!open) return <button className="add-kid" onClick={() => setOpen(true)}>+ Add a child</button>;
  return (
    <div className="row editing">
      <KidFields form={form} setForm={setForm} />
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

function KidFields({ form, setForm }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="kid-row">
      <input aria-label="First name" placeholder="First name" value={form.firstName} onChange={set("firstName")} />
      <input aria-label="Grade" placeholder="Grade (e.g. K, 3rd)" value={form.grade} onChange={set("grade")} />
      <input aria-label="School" placeholder="School (optional)" value={form.school} onChange={set("school")} />
    </div>
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
