"use client";

// The page a texted sign-in link opens. It waits for the parent to tap
// "Continue" on purpose: phones preview links automatically, and a preview
// must not use up the one-time link.

import { useEffect, useState } from "react";
import Link from "next/link";

export default function FamilyLogin() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("ready"); // ready | working | error
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t") || "");
  }, []);

  async function signIn() {
    setStatus("working");
    setError("");
    try {
      const res = await fetch("/api/family/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      window.location.replace("/family");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <section className="container family">
      <div className="form-card family-login">
        <h1>Manage your family</h1>
        {token ? (
          <>
            <p className="hint">Tap continue to sign in on this device.</p>
            <button className="btn" onClick={signIn} disabled={status === "working"}>
              {status === "working" ? "Signing in…" : "Continue"}
            </button>
          </>
        ) : (
          <p className="hint">This link is missing its code. Text SETTINGS to Bellio for a new one.</p>
        )}
        {status === "error" && (
          <p className="form-error" role="alert">
            {error} <Link href="/family">Get a new link</Link>
          </p>
        )}
      </div>
    </section>
  );
}
