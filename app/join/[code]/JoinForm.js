"use client";

import { useState } from "react";
import ConsentCheckbox from "../../ConsentCheckbox";
import CopyField from "../../CopyField";
import BotCheck, { botCheckFields, resetBotCheck } from "../../BotCheck";

export default function JoinForm({ code }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          code,
          isGuardian: data.isGuardian === "on",
          smsConsent: data.smsConsent === "on",
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
        <p>
          You&rsquo;ll get the same reminders as the rest of your family.
          Forward any school emails you get to:
        </p>
        {result.forwardingAddress && <CopyField value={result.forwardingAddress} />}
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
        Mobile phone
        <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required />
      </label>
      <label>
        Email <span className="optional">(optional)</span>
        <input name="email" type="email" autoComplete="email" />
      </label>
      <label className="consent">
        <input name="isGuardian" type="checkbox" required />
        <span>I&rsquo;m a parent or legal guardian of the children in this family.</span>
      </label>
      <ConsentCheckbox />
      <BotCheck />
      <button type="submit" className="btn" disabled={status === "sending"}>
        {status === "sending" ? "Joining…" : "Join family"}
      </button>
      {status === "error" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
