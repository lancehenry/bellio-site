// Protection against bots and "SMS pumping" (bots entering thousands of phone
// numbers so our welcome texts run up the Twilio bill).
//
//   - Honeypot: a hidden form field only bots fill in.
//   - Turnstile: Cloudflare's free, usually invisible bot check (needs keys; see .env.example).
//   - Rate limits: per IP address, per phone number, and a daily cap on
//     texts that a web form can trigger.

import crypto from "node:crypto";
import { insert, query } from "@/lib/db";

// Limits. Adjust here if real parents ever bump into them.
export const LIMITS = {
  signupPerIp: { bucket: "signup_ip", max: 5, minutes: 60 },
  joinPerIp: { bucket: "join_ip", max: 5, minutes: 60 },
  welcomePerPhone: { bucket: "welcome_phone", max: 3, minutes: 24 * 60 },
  welcomeTotalPerDay: { bucket: "welcome_all", max: 100, minutes: 24 * 60 },
  invitePerMember: { bucket: "invite_member", max: 5, minutes: 24 * 60 },
  strangerReplyPerPhone: { bucket: "stranger_reply", max: 1, minutes: 24 * 60 },
  // Manage Family sign-in links (each one is a text).
  loginLinkPerPhone: { bucket: "login_phone", max: 3, minutes: 60 },
  loginLinkPerIp: { bucket: "login_ip", max: 10, minutes: 60 },
  familyActionsPerMember: { bucket: "family_action", max: 60, minutes: 60 },
  // Each photo or email costs an AI call; these caps are far above normal use.
  photosPerMember: { bucket: "photo_member", max: 20, minutes: 24 * 60 },
  emailsPerFamily: { bucket: "email_family", max: 50, minutes: 24 * 60 },
};

// The visitor's IP address, as reported by Vercel.
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

// IPs and phone numbers are hashed before being stored for rate limiting.
function hashKey(value) {
  const salt = process.env.RATE_LIMIT_SALT || process.env.INBOUND_WEBHOOK_SECRET || "bellio";
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

// Records an attempt and says whether it's over the limit.
// Returns true when the limit is reached (and does NOT record it).
// If the database check itself fails, it lets the request through and logs
// the problem, so a hiccup never blocks real parents.
export async function overLimit({ bucket, max, minutes }, rawKey) {
  try {
    const key = hashKey(rawKey);
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const recent = await query(
      "rate_events",
      `bucket=eq.${bucket}&key=eq.${key}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${max}`
    );
    if (recent.length >= max) {
      console.warn(`Rate limit reached: ${bucket}`);
      return true;
    }
    await insert("rate_events", { bucket, key });
    return false;
  } catch (err) {
    console.error(`Rate limit check failed for ${bucket} (allowing): ${err.message}`);
    return false;
  }
}

// True if the hidden "website" field was filled in, which only bots do.
export function isHoneypotFilled(body) {
  return !!String(body?.website || "").trim();
}

// Checks the Cloudflare Turnstile token from the form.
// If Turnstile isn't set up yet (no secret key), this allows the request and logs a reminder.
export async function passedTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("Turnstile isn't set up yet (TURNSTILE_SECRET_KEY missing); skipping bot check.");
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: String(token), ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
    });
    const data = await res.json();
    if (!data.success) console.warn("Turnstile check failed:", (data["error-codes"] || []).join(", "));
    return !!data.success;
  } catch (err) {
    // If Cloudflare can't be reached, don't lock real parents out; the rate limits still apply.
    console.error(`Turnstile verify failed (allowing): ${err.message}`);
    return true;
  }
}

// Whether a form-triggered text (welcome, join) may be sent to this phone right now.
export async function mayTextFromForm(phone) {
  if (await overLimit(LIMITS.welcomeTotalPerDay, "all")) {
    console.error("Daily cap on form-triggered texts reached. Possible bot attack; check signups.");
    return false;
  }
  return !(await overLimit(LIMITS.welcomePerPhone, phone));
}
