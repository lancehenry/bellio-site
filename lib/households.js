// Shared helpers for households, members, and kids.

// (In the database a family is a "household"; on the site and in texts we say "family".)

import { insert, query, select } from "@/lib/db";

export const INBOUND_DOMAIN = process.env.INBOUND_DOMAIN || "inbox.heybellio.com";
export const SITE_URL = (process.env.SITE_URL || "https://www.heybellio.com").replace(/\/$/, "");
export const MAX_MEMBERS = 2; // parents/guardians per family; email hello@ for exceptions
export const MAX_KIDS = 8;
export const INVITE_DAYS = 7;
export const INVITE_CODE_RE = /^[a-f0-9]{12}$/;
export const FULL_FAMILY_MESSAGE =
  `Your family already has ${MAX_MEMBERS} adults, the most allowed. Need to make a change? Email hello@heybellio.com.`;

export const forwardingAddress = (household) => `${household.inbox_key}@${INBOUND_DOMAIN}`;
export const inviteUrl = (invite) => `${SITE_URL}/join/${invite.code}`;

// Creates a single-use invite link that expires in INVITE_DAYS days.
export async function createInvite(householdId, memberId) {
  const [invite] = await insert("invites", { household_id: householdId, created_by: memberId });
  return invite;
}

// Looks up an invite and says whether it can still be used.
// Returns { invite, household, problem } where problem is null, "invalid", "used", or "expired".
export async function checkInvite(code) {
  if (!INVITE_CODE_RE.test(code || "")) return { problem: "invalid" };
  const [invite] = await select("invites", { code });
  if (!invite) return { problem: "invalid" };
  const [household] = await select("households", { id: invite.household_id });
  if (!household || household.subscription_status === "canceled") return { problem: "invalid" };
  if (invite.used_at) return { invite, household, problem: "used" };
  if (new Date(invite.expires_at) < new Date()) return { invite, household, problem: "expired" };
  return { invite, household, problem: null };
}

export const INVITE_PROBLEMS = {
  invalid: "This invite link isn't valid.",
  used: "This invite link has already been used. Ask for a new one: they can text INVITE to Bellio.",
  expired: `This invite link has expired (links last ${INVITE_DAYS} days). Ask for a new one: they can text INVITE to Bellio.`,
};

// "(913) 555-1234" -> "+19135551234", or null if it isn't a US number.
export function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

// Cleans up the kids list from a form: trims, drops blanks, caps the count.
export function cleanKids(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((k) => ({
      first_name: String(k?.firstName || k?.first_name || "").trim().slice(0, 40),
      grade: String(k?.grade || "").trim().slice(0, 40) || null,
      school: String(k?.school || "").trim().slice(0, 80) || null,
    }))
    .filter((k) => k.first_name)
    .slice(0, MAX_KIDS);
}

export async function getKids(householdId) {
  return query("kids", `household_id=eq.${householdId}&select=id,first_name,grade,school&order=created_at`);
}

export async function getMembers(householdId) {
  return query("members", `household_id=eq.${householdId}&select=*&order=created_at`);
}

// Members who should receive texts: consented and not opted out.
export async function getTextableMembers(householdId) {
  return query(
    "members",
    `household_id=eq.${householdId}&sms_consent=eq.true&sms_opted_out=eq.false&select=*&order=created_at`
  );
}

export async function findMemberByPhone(phone) {
  const [member] = await select("members", { phone });
  return member || null;
}

export async function addKids(householdId, kids) {
  if (!kids.length) return [];
  return insert("kids", kids.map((k) => ({ household_id: householdId, ...k })));
}
