// The Manage Family page's data and actions. Every request is checked against
// the signed-in member, and every change is limited to their own family.
//
// GET  → the family: forwarding address, kids, adults, and who you are
// POST → { action: ... }
//   addKid, updateKid, removeKid
//   dismissEvent              (removes a wrong reminder; it won't be texted or re-added)
//   startPhoneChange          (texts a 6-digit code to the new number)
//   confirmPhoneChange        (checks the code, then switches the number)
//   newInvite                 (when the family has room for another adult)
//   removeMember              (owner only, removes a co-parent)
//   stopTexts                 (stops texts to yourself; text START to resume)
//   leaveFamily               (if you're the owner, the co-parent becomes owner)
//   deleteFamily              (owner only; erases the family's data right away)
//   signOut

import crypto from "node:crypto";
import { deleteWhere, insert, query, select, update, updateWhere } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { getUpcoming, HEADS_UP_RE } from "@/lib/upcoming";
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
  normalizePhone,
} from "@/lib/households";

export const dynamic = "force-dynamic";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

const signedOut = () => json({ error: "Please sign in again." }, 401, { "Set-Cookie": clearSessionCookie() });

async function familyView(member, household) {
  const [kids, members] = await Promise.all([getKids(household.id), getMembers(household.id)]);
  const [pending] = await query(
    "phone_changes",
    `member_id=eq.${member.id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=new_phone&order=created_at.desc&limit=1`
  );
  return {
    upcoming: await getUpcoming(household, kids, 30),
    pendingPhoneEnd: pending ? pending.new_phone.slice(-4) : null,
    forwardingAddress: forwardingAddress(household),
    me: {
      id: member.id,
      firstName: member.first_name,
      role: member.role,
      textsOn: !member.sms_opted_out,
      phoneEnd: member.phone.slice(-4),
    },
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

      // ----- Reminders -----
      case "dismissEvent": {
        if (!UUID_RE.test(String(body.eventId || ""))) return json({ error: "That reminder isn't in your family." }, 404);
        const [event] = await select("events", { id: body.eventId });
        if (!event || event.household_id !== household.id) return json({ error: "That reminder isn't in your family." }, 404);
        const now = new Date().toISOString();
        await update("events", { id: event.id }, { dismissed_at: now });
        // Also remove its earlier "Coming up: ..." heads-up, if there is one.
        if (!HEADS_UP_RE.test(event.title)) {
          const core = event.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
          const ups = await query(
            "events",
            `household_id=eq.${household.id}&event_date=lt.${event.event_date}&dismissed_at=is.null&title=ilike.${encodeURIComponent("coming up:*")}&select=id,title`
          );
          for (const u of ups) {
            const t = u.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");
            if (core.length >= 4 && t.includes(core)) await update("events", { id: u.id }, { dismissed_at: now });
          }
        }
        console.log(`Member ${member.id} dismissed event ${event.id}`);
        break;
      }

      // ----- Your phone number -----
      case "startPhoneChange": {
        const phone = normalizePhone(body.phone);
        if (!phone) return json({ error: "Please enter a 10-digit US mobile number." }, 400);
        if (phone === member.phone) return json({ error: "That's already your number." }, 400);
        if (!body.consent) return json({ error: "Please check the box to agree to texts at the new number." }, 400);
        if (
          (await overLimit(LIMITS.phoneCodePerMember, member.id)) ||
          (await overLimit(LIMITS.phoneCodePerNumber, phone))
        ) {
          return json({ error: "You've asked for several codes recently. Please wait an hour and try again." }, 429);
        }
        const [taken] = await select("members", { phone });
        if (taken) {
          return json({ error: `That number is already used in Bellio. If it's yours, email hello@heybellio.com.` }, 400);
        }
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        await deleteWhere("phone_changes", `member_id=eq.${member.id}`);
        await insert("phone_changes", { member_id: member.id, new_phone: phone, code_hash: hashCode(member.id, code) });
        await sendSms(
          { id: member.id, household_id: household.id, phone },
          `Bellio: Your code to confirm this number is ${code}. It expires in 10 minutes. If you didn't ask for this, ignore this text.`
        );
        console.log(`Member ${member.id} asked to change their number to ...${phone.slice(-4)}`);
        break;
      }
      case "cancelPhoneChange": {
        await deleteWhere("phone_changes", `member_id=eq.${member.id}`);
        break;
      }
      case "confirmPhoneChange": {
        const code = String(body.code || "").replace(/\D/g, "");
        const [pending] = await query(
          "phone_changes",
          `member_id=eq.${member.id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=1`
        );
        if (!pending) return json({ error: "That code has expired. Ask for a new one." }, 400);
        if (pending.attempts >= 5) {
          await deleteWhere("phone_changes", `member_id=eq.${member.id}`);
          return json({ error: "Too many tries. Ask for a new code." }, 400);
        }
        // Count the try first, so guesses can't skip the limit.
        const counted = await updateWhere(
          "phone_changes",
          `id=eq.${pending.id}&attempts=eq.${pending.attempts}`,
          { attempts: pending.attempts + 1 }
        );
        if (!counted.length) return json({ error: "Please try again." }, 409);
        const a = Buffer.from(hashCode(member.id, code));
        const b = Buffer.from(pending.code_hash);
        if (code.length !== 6 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          const left = 4 - pending.attempts;
          return json({ error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many tries. Ask for a new code." }, 400);
        }
        const [taken] = await select("members", { phone: pending.new_phone });
        if (taken) {
          await deleteWhere("phone_changes", `member_id=eq.${member.id}`);
          return json({ error: "That number was just added to Bellio by someone else. Email hello@heybellio.com." }, 400);
        }
        const oldPhone = member.phone;
        const now = new Date().toISOString();
        const changed = { phone: pending.new_phone, sms_consent: true, sms_opted_out: false, consent_at: now, consent_source: "phone_change" };
        await update("members", { id: member.id }, changed);
        await deleteWhere("phone_changes", `member_id=eq.${member.id}`);
        await recordConsent(pending.new_phone, "opt_in", "phone_change", household.id);
        await recordConsent(oldPhone, "opt_out", "phone_change", household.id);
        console.log(`Member ${member.id} changed their number to ...${pending.new_phone.slice(-4)}`);
        // Let the old number know, in case this wasn't them.
        if (!member.sms_opted_out) {
          try {
            await sendSms(
              { id: member.id, household_id: household.id, phone: oldPhone },
              `Bellio: The number on your Bellio account was changed to one ending in ${pending.new_phone.slice(-4)}. Texts now go there. If this wasn't you, email hello@heybellio.com.`
            );
          } catch (err) {
            console.error(`Old-number notice failed: ${err.message}`);
          }
        }
        return json({ ...(await familyView({ ...member, ...changed }, household)), phoneChanged: true });
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

function hashCode(memberId, code) {
  return crypto.createHash("sha256").update(`${memberId}:${code}`).digest("hex");
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
