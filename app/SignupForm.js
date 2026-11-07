"use client";

import { useState } from "react";
import Link from "next/link";
import site from "@/site.config";

export default function SignupForm() {
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");

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
        body: JSON.stringify({ ...data, smsConsent: data.smsConsent === "on" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setStatus("done");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  if (status === "done") {
    return (
      <div className="form-card success" role="status">
        <h3>You&rsquo;re on the list!</h3>
        <p>
          We&rsquo;ll be in touch soon with your forwarding address and setup
          steps.
        </p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <label>
        First name
        <input name="firstName" type="text" autoComplete="given-name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Mobile phone
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(555) 555-5555"
          required
        />
      </label>

      <label className="consent">
        <input name="smsConsent" type="checkbox" required />
        <span>
          I agree to receive recurring text reminders from {site.name} at the
          number provided. Message frequency varies. Msg &amp; data rates may
          apply. Reply STOP to cancel, HELP for help. Consent is not a
          condition of purchase. See our{" "}
          <Link href="/terms">SMS Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>

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
