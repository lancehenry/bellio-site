// Sign-in for the Manage Family page. There are no passwords: a parent gets a
// one-time link by text (text SETTINGS, or enter their phone on /family).
// Opening the link and tapping "Continue" signs them in with a cookie.
//
// - Link codes are random, single-use, expire in 15 minutes, and are stored hashed.
// - The sign-in cookie is signed so it can't be forged, lasts 7 days, and is
//   checked against the database on every request, so removing someone from a
//   family signs them out immediately.

import crypto from "node:crypto";
import { insert, select, updateWhere } from "@/lib/db";
import { SITE_URL } from "@/lib/households";

const COOKIE = "bellio_session";
const SESSION_DAYS = 7;
const LINK_MINUTES = 15;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Fall back to a key derived from another server secret, so no new setup is required.
  const base = process.env.SUPABASE_SECRET_KEY || process.env.CRON_SECRET;
  if (!base) throw new Error("SESSION_SECRET (or SUPABASE_SECRET_KEY) must be set.");
  return crypto.createHmac("sha256", base).update("bellio-session-v1").digest("hex");
}

const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const b64url = (buf) => Buffer.from(buf).toString("base64url");

// ---------- One-time login links ----------

export async function createLoginLink(member) {
  const token = b64url(crypto.randomBytes(24));
  await insert("login_tokens", {
    member_id: member.id,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + LINK_MINUTES * 60 * 1000).toISOString(),
  });
  return `${SITE_URL}/family/login?t=${token}`;
}

export const LOGIN_LINK_MINUTES = LINK_MINUTES;

// Uses up a login code. Returns the member, or null if the link is invalid,
// expired, or already used. Only one request can ever claim a given link.
export async function consumeLoginToken(token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || "")) return null;
  const now = new Date().toISOString();
  const claimed = await updateWhere(
    "login_tokens",
    `token_hash=eq.${sha256(token)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}`,
    { used_at: now }
  );
  if (!claimed.length) return null;
  const [member] = await select("members", { id: claimed[0].member_id });
  return member || null;
}

// ---------- Sign-in cookie ----------

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function sessionCookie(memberId) {
  const payload = b64url(JSON.stringify({ m: memberId, e: Date.now() + SESSION_DAYS * 86400000 }));
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// The signed-in member, or null. Always re-checked against the database.
export async function getSessionMember(request) {
  const raw = readCookie(request, COOKIE);
  if (!raw || !raw.includes(".")) return null;
  const [payload, sig] = raw.split(".");
  const expected = sign(payload);
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data?.m || !data?.e || data.e < Date.now()) return null;
  const [member] = await select("members", { id: data.m });
  if (!member) return null;
  const [household] = await select("households", { id: member.household_id });
  if (!household || household.subscription_status === "canceled") return null;
  return { member, household };
}

// Blocks form posts that come from another website (a second layer on top of
// SameSite cookies).
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers may omit it
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
