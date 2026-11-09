// Receives the signup form. Creates a family (a "household" in the database),
// its first member (with their text-message consent), and the kids. Returns the
// family's forwarding address and a single-use link to invite a co-parent.

import { insert, update } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import {
  addKids,
  cleanKids,
  createInvite,
  findMemberByPhone,
  forwardingAddress,
  inviteUrl,
  normalizePhone,
} from "@/lib/households";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  const kids = cleanKids(body.kids);

  if (!firstName) {
    return Response.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "Please enter a valid US mobile number." }, { status: 400 });
  }
  if (!kids.length) {
    return Response.json({ error: "Please add at least one child's first name." }, { status: 400 });
  }
  if (body.smsConsent !== true) {
    return Response.json(
      { error: "Please check the box to agree to receive text reminders." },
      { status: 400 }
    );
  }

  try {
    if (await findMemberByPhone(phone)) {
      return Response.json(
        { error: "That number is already signed up. Questions? Email hello@heybellio.com." },
        { status: 409 }
      );
    }

    const [household] = await insert("households", {});
    let member;
    try {
      [member] = await insert("members", {
        household_id: household.id,
        first_name: firstName,
        email,
        phone,
        role: "owner",
        sms_consent: true,
        consent_at: new Date().toISOString(),
        // Keep a record of how consent was collected; carriers can ask for it.
        consent_source: "heybellio.com signup form",
      });
    } catch (err) {
      // Don't leave an empty household behind if the member couldn't be saved.
      await update("households", { id: household.id }, { subscription_status: "canceled" }).catch(() => {});
      throw err;
    }
    await addKids(household.id, kids);

    console.log(`New family ${household.id} with ${kids.length} kid(s)`);
    const address = forwardingAddress(household);
    let invite = null;
    try {
      invite = inviteUrl(await createInvite(household.id, member.id));
    } catch (err) {
      console.error(`Creating invite for family ${household.id} failed: ${err.message}`);
    }

    // Welcome text. (Only actually sent once SMS_SENDING_ENABLED is on.)
    // A failed text should never break signup, so errors are just logged.
    try {
      await sendSms(
        member,
        `Bellio: Welcome, ${firstName}! Forward school emails to ${address} or text a photo of a flyer here. ` +
          `We'll text you the night before anything you need to know. Save this number as "Bellio". ` +
          `Text INVITE to add a co-parent. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`
      );
    } catch (err) {
      console.error(`Welcome text to member ${member.id} failed: ${err.message}`);
    }

    return Response.json({ ok: true, forwardingAddress: address, inviteUrl: invite });
  } catch (err) {
    console.error("Signup failed:", err);
    return Response.json(
      { error: "Something went wrong saving your signup. Please try again." },
      { status: 500 }
    );
  }
}
