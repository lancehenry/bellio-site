// Sending and verifying text messages through Twilio.

import crypto from "node:crypto";
import { insert } from "@/lib/db";

// Safety switch: nothing is actually texted until SMS_SENDING_ENABLED=true in Vercel.
// Turn it on once Twilio approves your toll-free number.
export function smsEnabled() {
  return process.env.SMS_SENDING_ENABLED === "true";
}

function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER must be set in Vercel.");
  }
  return { sid, token, from };
}

export function twilioAuthHeader() {
  const { sid, token } = twilioConfig();
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// --- Plain characters only --------------------------------------------------
// A text that contains even one "fancy" character (curly quote, bullet, emoji,
// accented letter, long dash) is sent in a different format that fits only 70
// characters per piece instead of 160, roughly doubling the cost. So every
// outgoing text is cleaned to plain keyboard characters first.

const SWAPS = [
  [/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'"], // curly/odd apostrophes
  [/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"'], // curly quotes
  [/[\u2010-\u2015\u2212\u2043]/g, "-"], // hyphens and dashes
  [/\u2026/g, "..."], // ellipsis
  [/[\u2022\u2023\u25AA\u25AB\u25CF\u25E6\u00B7\u2219]/g, "-"], // bullets
  [/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " "], // odd spaces
  [/[\u200B-\u200D\u2060\uFEFF]/g, ""], // invisible characters
  [/[\u2190-\u21FF]/g, "-"], // arrows
  [/\u00D7/g, "x"],
  [/\u00BD/g, "1/2"],
  [/\u00BC/g, "1/4"],
  [/\u00BE/g, "3/4"],
  [/\u20AC/g, "EUR"],
  [/[\[{]/g, "("], // these count as two characters in a text
  [/[\]}]/g, ")"],
  [/[\\|]/g, "/"],
  [/~/g, "-"],
  [/\^/g, ""],
];

export function plainText(text) {
  let s = String(text || "");
  for (const [re, to] of SWAPS) s = s.replace(re, to);
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // é -> e, ñ -> n
  s = s.replace(/[^\x20-\x7E\n]/g, ""); // drop anything left (emoji, symbols)
  return s
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// How many billable pieces ("segments") a plain text uses: 160 characters for
// one, 153 each when it's longer.
export function segmentCount(text) {
  const n = String(text || "").length;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

// Sends one text to a household member and records it in the messages table.
// When the safety switch is off, it only logs what it would have sent.
export async function sendSms(member, rawBody) {
  const body = plainText(rawBody);
  if (!smsEnabled()) {
    console.log(`[SMS not sent: SMS_SENDING_ENABLED is off] to ...${member.phone.slice(-4)}:\n${body}`);
    return { sent: false };
  }

  const { sid, from } = twilioConfig();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: member.phone, From: from, Body: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Twilio error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }

  await insert("messages", {
    household_id: member.household_id,
    member_id: member.id,
    direction: "outbound",
    body,
    twilio_sid: data.sid,
  });
  return { sent: true, sid: data.sid };
}

// Confirms an incoming webhook really came from Twilio.
// https://www.twilio.com/docs/usage/security#validating-requests
export function isValidTwilioRequest(url, params, signature) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", token).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// A TwiML reply (Twilio's format for answering an incoming text).
export function twiml(rawMessage) {
  const message = rawMessage ? plainText(rawMessage) : "";
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const body = message ? `<Response><Message>${escaped}</Message></Response>` : "<Response/>";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "text/xml" },
  });
}
