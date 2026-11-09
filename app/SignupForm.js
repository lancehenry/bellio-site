"use client";

import { useState } from "react";
import ConsentCheckbox from "./ConsentCheckbox";
import CopyField from "./CopyField";
import BotCheck, { botCheckFields, resetBotCheck } from "./BotCheck";

const MAX_KIDS = 8;
const emptyKid = () => ({ firstName: "", grade: "", school: "" });

export default function SignupForm() {
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [kids, setKids] = useState([emptyKid()]);

  const setKid = (i, field, value) =>
    setKids((list) => list.map((k, j) => (j === i ? { ...k, [field]: value } : k)));
  const addKid = () => setKids((list) => (list.length < MAX_KIDS ? [...list, emptyKid()] : list));
  const removeKid = (i) => setKids((list) => list.filter((_, j) => j !== i));

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          email: data.email,
          phone: data.phone,
          smsConsent: data.smsConsent === "on",
          kids,
          ...botCheckFields(data),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setResult(body);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err.message);
      resetBotCheck();
    }
  }

  if (status === "done" && result) {
    return (
      <div className="form-card success" role="status">
        <h3>You&rsquo;re in!</h3>
        {result.forwardingAddress && (
          <>
            <p>Forward your school emails to your family&rsquo;s Bellio address:</p>
            <CopyField value={result.forwardingAddress} />
          </>
        )}
        <p>
          We&rsquo;ll text you the night before anything you need to know or
          do. You can also text a photo of a paper flyer to our number.
        </p>
        {result.inviteUrl && (
          <>
            <h4>Add a co-parent</h4>
            <p>
              Send them this link to get the same reminders on their own phone.
              It works once and expires in 7 days. Need another? Text INVITE to
              Bellio.
            </p>
            <CopyField value={result.inviteUrl} label="Copy link" />
            <p className="hint">
              Co-parent in a different home? They can join your family to share
              reminders, or sign up on their own with a separate account.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <label>
        Your first name
        <input name="firstName" type="text" autoComplete="given-name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Mobile phone
        <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required />
      </label>

      <fieldset className="kids">
        <legend>Your kids</legend>
        <p className="hint">Grade and school help us match each reminder to the right kid.</p>
        {kids.map((kid, i) => (
          <div className="kid-row" key={i}>
            <input
              aria-label={`Child ${i + 1} first name`}
              placeholder="First name"
              value={kid.firstName}
              onChange={(e) => setKid(i, "firstName", e.target.value)}
              required={i === 0}
            />
            <input
              aria-label={`Child ${i + 1} grade`}
              placeholder="Grade (e.g. K, 3rd)"
              value={kid.grade}
              onChange={(e) => setKid(i, "grade", e.target.value)}
            />
            <input
              aria-label={`Child ${i + 1} school`}
              placeholder="School (optional)"
              value={kid.school}
              onChange={(e) => setKid(i, "school", e.target.value)}
            />
            {kids.length > 1 && (
              <button type="button" className="remove-kid" onClick={() => removeKid(i)} aria-label={`Remove child ${i + 1}`}>
                ×
              </button>
            )}
          </div>
        ))}
        {kids.length < MAX_KIDS && (
          <button type="button" className="add-kid" onClick={addKid}>
            + Add another child
          </button>
        )}
      </fieldset>

      <ConsentCheckbox />
      <BotCheck />

      <button type="submit" className="btn" disabled={status === "sending"}>
        {status === "sending" ? "Signing up…" : "Sign up"}
      </button>
      {status === "error" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
