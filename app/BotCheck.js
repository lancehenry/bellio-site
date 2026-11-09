"use client";

import Script from "next/script";

// Two quiet bot checks for the signup and join forms:
//   1. Cloudflare Turnstile: usually invisible; occasionally asks for one click.
//      Shows nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in Vercel.
//   2. A honeypot: a "website" field hidden from people. Bots fill it in; people never see it.
export default function BotCheck() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {siteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-size="flexible" />
        </>
      )}
    </>
  );
}

// Reads the bot-check values from a submitted form.
export function botCheckFields(data) {
  return { website: data.website || "", turnstileToken: data["cf-turnstile-response"] || "" };
}

// Each Turnstile token works once, so get a fresh one after a failed submit.
export function resetBotCheck() {
  try {
    window.turnstile?.reset();
  } catch {}
}
