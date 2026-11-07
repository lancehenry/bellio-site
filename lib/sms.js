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

// Sends one text and records it in the messages table.
// When the safety switch is off, it only logs what it would have sent.
export async function sendSms(parent, body) {
  if (!smsEnabled()) {
    console.log(`[SMS not sent: SMS_SENDING_ENABLED is off] to ...${parent.phone.slice(-4)}:\n${body}`);
    return { sent: false };
  }

  const { sid, from } = twilioConfig();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: parent.phone, From: from, Body: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Twilio error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }

  await insert("messages", { parent_id: parent.id, direction: "outbound", body, twilio_sid: data.sid });
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
export function twiml(message) {
  const escaped = (message || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const body = message ? `<Response><Message>${escaped}</Message></Response>` : "<Response/>";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "text/xml" },
  });
}
