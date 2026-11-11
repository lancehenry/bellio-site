// The Manage Family page's data and actions. Every request is checked against
// the signed-in member, and every change is limited to their own family.
//
// GET  → the family: forwarding address, kids, adults, and who you are
// POST → { action: ... }
//   addKid, updateKid, removeKid
//   newInvite                 (when the family has room for another adult)
//   removeMember              (owner only, removes a co-parent)
//   stopTexts                 (stops texts to yourself; text START to resume)
//   leaveFamily               (if you're the owner, the co-parent becomes owner)
//   deleteFamily              (owner only; erases the family's data right away)
//   signOut

import { deleteWhere, insert, query, select, update } from "@/lib/db";
import { recordConsent } from "@/lib/consent";
import { LIMITS, overLimit } from "@/lib/protect";
import { clearSessionCookie, getSessionMember, sameOrigin } from "@/lib/session";
import {
  INVITE_DAYS,
  MAX_KIDS,
  MAX_MEMBERS,
  cleanKids,
  createInvite,
  forwardingAddress,
  getKids,
  getMembers,
  inviteUrl,
} from "@/lib/households";

export const dynamic = "force-dynamic";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

const signedOut = () => json({ error: "Please sign in again." }, 401, { "Set-Cookie": clearSessionCookie() });

async function familyView(member, household) {
  const [kids, members] = await Promise.all([getKids(household.id), getMembers(household.id)]);
  return {
    forwardingAddress: forwardingAddress(household),
    me: { id: member.id, firstName: member.first_name, role: member.role, textsOn: !member.sms_opted_out },
    kids: kids.map((k) => ({ id: k.id, firstName: k.first_name, grade: k.grade || "", school: k.school || "" })),
    adults: members.map((m) => ({
      id: m.id,
      firstName: m.first_name,
      phoneEnd: m.phone.slice(-4),
      role: m.role,
      textsOn: !m.sms_opted_out,
      isMe: m.id === member.id,
    })),
    maxAdults: MAX_MEMBERS,
    maxKids: MAX_KIDS,
  };
}

export async function GET(request) {
  const session = await getSessionMember(request);
  if (!session) return signedOut();
  return json(await familyView(session.member, session.household));
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const session = await getSessionMember(request);
  if (!session) return signedOut();
  const { member, household } = session;
  const isOwner = member.role === "owner";

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (await overLimit(LIMITS.familyActionsPerMember, member.id)) {
    return json({ error: "Too many changes in a short time. Please wait a bit and try again." }, 429);
  }

  try {
    switch (body.action) {
      // ----- Kids -----
      case "addKid": {
        const [kid] = cleanKids([body.kid]);
        if (!kid) return json({ error: "Please enter the child's first name." }, 400);
        const kids = await getKids(household.id);
        if (kids.length >= MAX_KIDS) return json({ error: `A family can have up to ${MAX_KIDS} kids.` }, 400);
        await insert("kids", { household_id: household.id, ...kid });
        break;
      }
      case "updateKid": {
        const kidRow = await ownKid(household.id, body.kidId);
        if (!kidRow) return json({ error: "That child isn't in your family." }, 404);
        const [kid] = cleanKids([body.kid]);
        if (!kid) return json({ error: "Please enter the child's first name." }, 400);
        await update("kids", { id: kidRow.id }, kid);
        break;
      }
      case "removeKid": {
        const kidRow = await ownKid(household.id, body.kidId);
        if (!kidRow) return json({ error: "That child isn't in your family." }, 404);
        // Reminders only for this child are deleted (so they don't go to the whole
        // family); shared reminders just drop this child.
        const tagged = await query(
          "events",
          `household_id=eq.${household.id}&kid_ids=cs.${encodeURIComponent(`{${kidRow.id}}`)}&select=id,kid_ids`
        );
        for (const e of tagged) {
          const rest = (e.kid_ids || []).filter((id) => id !== kidRow.id);
          if (rest.length) await update("events", { id: e.id }, { kid_ids: rest });
          else await deleteWhere("events", `id=eq.${e.id}&household_id=eq.${household.id}`);
        }
        await deleteWhere("kids", `id=eq.${kidRow.id}&household_id=eq.${household.id}`);
        break;
      }

      // ----- Adults -----
      case "newInvite": {
        const members = await getMembers(household.id);
        if (members.length >= MAX_MEMBERS) {
          return json({ error: `Your family already has ${MAX_MEMBERS} adults, the most allowed.` }, 400);
        }
        if (await overLimit(LIMITS.invitePerMember, member.id)) {
          return json({ error: "You've made several invite links today. Please try again tomorrow." }, 429);
        }
        const invite = await createInvite(household.id, member.id);
        return json({ ...(await familyView(member, household)), inviteUrl: inviteUrl(invite), inviteDays: INVITE_DAYS });
      }
      case "removeMember": {
        if (!isOwner) return json({ error: "Only the person who set up the family can remove someone." }, 403);
        if (!UUID_RE.test(String(body.memberId || ""))) return json({ error: "That person isn't in your family." }, 404);
        const [target] = await select("members", { id: body.memberId });
        if (!target || target.household_id !== household.id) return json({ error: "That person isn't in your family." }, 404);
        if (target.id === member.id) return json({ error: "To remove yourself, use Leave family." }, 400);
        await deleteWhere("members", `id=eq.${target.id}&household_id=eq.${household.id}`);
        await recordConsent(target.phone, "opt_out", "removed_from_family", household.id);
        await expireOpenInvites(household.id); // an old link can't be used to rejoin
        console.log(`Member ${member.id} removed member ${target.id} from family ${household.id}`);
        break;
      }
      case "stopTexts": {
        await update("members", { id: member.id }, { sms_opted_out: true });
        await recordConsent(member.phone, "opt_out", "web_settings", household.id);
        return json({ ...(await familyView({ ...member, sms_opted_out: true }, household)) });
      }
      case "leaveFamily": {
        const members = await getMembers(household.id);
        const others = members.filter((m) => m.id !== member.id);
        if (isOwner && !others.length) {
          return json({ error: "You're the only adult. To leave, delete the family instead." }, 400);
        }
        if (isOwner) await update("members", { id: others[0].id }, { role: "owner" });
        await deleteWhere("members", `id=eq.${member.id}&household_id=eq.${household.id}`);
        await recordConsent(member.phone, "opt_out", "left_family", household.id);
        console.log(`Member ${member.id} left family ${household.id}`);
        return json({ ok: true, left: true }, 200, { "Set-Cookie": clearSessionCookie() });
      }
      case "deleteFamily": {
        if (!isOwner) return json({ error: "Only the person who set up the family can delete it." }, 403);
        if (String(body.confirm || "").trim().toUpperCase() !== "DELETE") {
          return json({ error: 'Type DELETE to confirm.' }, 400);
        }
        const members = await getMembers(household.id);
        for (const m of members) await recordConsent(m.phone, "opt_out", "family_deleted", null);
        // Removes the family and everything linked to it (adults, kids, emails, events,
        // invites, texts). Opt-in/opt-out records are kept, as the Privacy Policy says.
        await deleteWhere("households", `id=eq.${household.id}`);
        console.log(`Family ${household.id} deleted by member ${member.id}`);
        return json({ ok: true, deleted: true }, 200, { "Set-Cookie": clearSessionCookie() });
      }
      case "signOut":
        return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
      default:
        return json({ error: "Unknown action." }, 400);
    }
    return json(await familyView(member, household));
  } catch (err) {
    console.error(`Family action "${body.action}" failed for member ${member.id}: ${err.message}`);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownKid(householdId, kidId) {
  if (!UUID_RE.test(String(kidId || ""))) return null;
  const [kid] = await select("kids", { id: kidId });
  return kid && kid.household_id === householdId ? kid : null;
}

async function expireOpenInvites(householdId) {
  const now = new Date().toISOString();
  const open = await query("invites", `household_id=eq.${householdId}&used_at=is.null&select=id`);
  for (const i of open) await update("invites", { id: i.id }, { expires_at: now });
}
