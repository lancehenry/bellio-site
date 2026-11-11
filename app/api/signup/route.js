// Receives the signup form. Creates a family (a "household" in the database),
// its first member (with their text-message consent), and the kids. Returns the
// family's forwarding address and a single-use link to invite a co-parent.

import { insert, select, update } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { recordConsent } from "@/lib/consent";
import {
  LIMITS,
  clientIp,
  isHoneypotFilled,
  mayTextFromForm,
  overLimit,
  passedTurnstile,
} from "@/lib/protect";
import {
  addKids,
  cleanKids,
  createInvite,
  findMemberByPhone,
  forwardingAddress,
  inviteUrl,
  normalizePhone,
} from "@/lib/households";

// Is this email already the owner of a family that's still active?
async function ownsActiveFamily(email) {
  const owners = await select("members", { email, role: "owner" }, "household_id");
  for (const { household_id } of owners) {
    const [household] = await select("households", { id: household_id }, "subscription_status");
    if (household && household.subscription_status !== "canceled") return true;
  }
  return false;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bot checks first. A filled-in honeypot gets a fake "success" so the bot learns nothing.
  if (isHoneypotFilled(body)) {
    console.warn("Signup honeypot triggered; ignoring.");
    return Response.json({ ok: true });
  }
  const ip = clientIp(request);
  if (await overLimit(LIMITS.signupPerIp, ip)) {
    return Response.json(
      { error: "Too many signups from this connection. Please try again in an hour." },
      { status: 429 }
    );
  }
  if (!(await passedTurnstile(body.turnstileToken, ip))) {
    return Response.json(
      { error: "We couldn't confirm you're not a robot. Please refresh the page and try again." },
      { status: 400 }
    );
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

    // One family per owner email, to catch accidental second signups.
    // (Co-parents joining by invite may share an email; that's checked separately and allowed.)
    if (await ownsActiveFamily(email)) {
      return Response.json(
        {
          error:
            "Looks like you already have a Bellio family with this email. Want to add a co-parent instead? " +
            "Text INVITE to Bellio, or email hello@heybellio.com.",
        },
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
      await update("households", { id: household.id }, {
        subscription_status: "canceled",
        canceled_at: new Date().toISOString(),
      }).catch(() => {});
      throw err;
    }
    await recordConsent(phone, "opt_in", "web_signup", household.id);
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
    // Limited per phone and per day so bots can't run up the texting bill.
    // A failed or skipped text never breaks signup; errors are just logged.
    try {
      if (!(await mayTextFromForm(phone))) {
        console.warn(`Welcome text to member ${member.id} skipped (rate limit).`);
      } else await sendSms(
        member,
        `Bellio: Welcome, ${firstName}! Forward school emails to ${address} or text a photo of a flyer here. ` +
          `We'll text you the night before anything you need to know. Save this number as "Bellio". ` +
          `Auto-forward setup: heybellio.com/setup. Text INVITE to add a co-parent. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`
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
