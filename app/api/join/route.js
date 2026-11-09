// A co-parent joining an existing family through a single-use invite link.
// They confirm they're a parent or guardian and opt in to texts themselves
// (carriers require each person's own consent).

import { insert, update, updateWhere } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import {
  FULL_FAMILY_MESSAGE,
  INVITE_PROBLEMS,
  MAX_MEMBERS,
  checkInvite,
  findMemberByPhone,
  forwardingAddress,
  getKids,
  getMembers,
  normalizePhone,
} from "@/lib/households";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = String(body.code || "").trim();
  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);

  if (!firstName) {
    return Response.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email, or leave it blank." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "Please enter a valid US mobile number." }, { status: 400 });
  }
  if (body.isGuardian !== true) {
    return Response.json(
      { error: "Bellio families are for parents and legal guardians. Please confirm you're a parent or guardian." },
      { status: 400 }
    );
  }
  if (body.smsConsent !== true) {
    return Response.json(
      { error: "Please check the box to agree to receive text reminders." },
      { status: 400 }
    );
  }

  try {
    const { invite, household, problem } = await checkInvite(code);
    if (problem) {
      return Response.json({ error: INVITE_PROBLEMS[problem] }, { status: problem === "invalid" ? 404 : 410 });
    }

    if (await findMemberByPhone(phone)) {
      return Response.json(
        { error: "That number is already signed up with Bellio. Questions? Email hello@heybellio.com." },
        { status: 409 }
      );
    }

    const members = await getMembers(household.id);
    if (members.length >= MAX_MEMBERS) {
      return Response.json({ error: FULL_FAMILY_MESSAGE }, { status: 409 });
    }

    // Claim the invite. Only one request can succeed, even if two arrive at once.
    const claimed = await updateWhere("invites", `id=eq.${invite.id}&used_at=is.null`, {
      used_at: new Date().toISOString(),
    });
    if (!claimed.length) {
      return Response.json({ error: INVITE_PROBLEMS.used }, { status: 410 });
    }

    let member;
    try {
      [member] = await insert("members", {
        household_id: household.id,
        first_name: firstName,
        email: email || null,
        phone,
        role: "co-parent",
        sms_consent: true,
        consent_at: new Date().toISOString(),
        consent_source: "heybellio.com invite link (confirmed parent/guardian)",
      });
    } catch (err) {
      // Release the invite so it can be tried again.
      await update("invites", { id: invite.id }, { used_at: null }).catch(() => {});
      throw err;
    }
    await update("invites", { id: invite.id }, { used_by: member.id }).catch(() => {});

    const kids = await getKids(household.id);
    const kidNames = kids.map((k) => k.first_name).join(" & ");
    const address = forwardingAddress(household);
    console.log(`Member ${member.id} joined family ${household.id}`);

    // Texts (only actually sent once SMS_SENDING_ENABLED is on). Failures are just logged.
    try {
      await sendSms(
        member,
        `Bellio: Welcome, ${firstName}! You'll get the same reminders as the rest of your family` +
          `${kidNames ? ` for ${kidNames}` : ""}. Forward school emails to ${address} or text a photo of a flyer here. ` +
          `Save this number as "Bellio". Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`
      );
      for (const other of members.filter((m) => m.sms_consent && !m.sms_opted_out)) {
        await sendSms(other, `Bellio: ${firstName} joined your family on Bellio and will get the same reminders.`);
      }
    } catch (err) {
      console.error(`Join texts for member ${member.id} failed: ${err.message}`);
    }

    return Response.json({ ok: true, forwardingAddress: address, kids: kids.map((k) => k.first_name) });
  } catch (err) {
    console.error("Join failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
