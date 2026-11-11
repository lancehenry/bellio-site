"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// Two quiet bot checks for Bellio's forms:
//   1. Cloudflare Turnstile: usually invisible; occasionally asks for one click.
//      Shows nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in Vercel.
//      Rendered explicitly, so it appears even when a page is reached through a
//      link inside the site (no full page reload).
//   2. A honeypot: a "website" field hidden from people. Bots fill it in; people never see it.

let widgetId = null;

export default function BotCheck() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef(null);

  function draw() {
    if (!siteKey || !box.current || !window.turnstile || box.current.childElementCount) return;
    widgetId = window.turnstile.render(box.current, {
      sitekey: siteKey,
      theme: "dark",
      size: "flexible",
      "response-field-name": "cf-turnstile-response",
    });
  }

  useEffect(() => {
    draw(); // if the script was already loaded by an earlier page
    return () => {
      try {
        if (widgetId !== null) window.turnstile?.remove(widgetId);
      } catch {}
      widgetId = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={draw}
          />
          <div ref={box} className="cf-turnstile" />
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
    if (widgetId !== null) window.turnstile?.reset(widgetId);
  } catch {}
}
