// Receives the signup form, saves the parent (and their text-message consent)
// to Supabase, and returns their personal forwarding address.

import { insert, select } from "@/lib/db";
import { sendSms } from "@/lib/sms";

const INBOUND_DOMAIN = process.env.INBOUND_DOMAIN || "inbox.heybellio.com";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phoneDigits = String(body.phone || "").replace(/\D/g, "");

  if (!firstName) {
    return Response.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!(phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1")))) {
    return Response.json({ error: "Please enter a valid US mobile number." }, { status: 400 });
  }
  if (body.smsConsent !== true) {
    return Response.json(
      { error: "Please check the box to agree to receive text reminders." },
      { status: 400 }
    );
  }

  const phone = "+1" + phoneDigits.slice(-10);

  try {
    const existing = await select("parents", { phone });
    if (existing.length) {
      return Response.json(
        { error: `That number is already signed up. Questions? Email hello@heybellio.com.` },
        { status: 409 }
      );
    }

    const [parent] = await insert("parents", {
      first_name: firstName,
      email,
      phone,
      sms_consent: true,
      consent_at: new Date().toISOString(),
      // Keep a record of how consent was collected; carriers can ask for it.
      consent_source: "heybellio.com signup form",
    });

    console.log("New signup:", parent.id);
    const forwardingAddress = `${parent.inbox_key}@${INBOUND_DOMAIN}`;

    // Welcome text. (Only actually sent once SMS_SENDING_ENABLED is on.)
    // A failed text should never break signup, so errors are just logged.
    try {
      await sendSms(
        parent,
        `Bellio: Welcome, ${firstName}! Forward school emails to ${forwardingAddress} or text a photo of a flyer here. ` +
          `We'll text you the night before anything you need to know. Save this number as "Bellio". ` +
          `Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`
      );
    } catch (err) {
      console.error(`Welcome text to parent ${parent.id} failed: ${err.message}`);
    }

    return Response.json({ ok: true, forwardingAddress });
  } catch (err) {
    console.error("Signup failed:", err);
    return Response.json(
      { error: "Something went wrong saving your signup. Please try again." },
      { status: 500 }
    );
  }
}
