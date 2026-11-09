// Twilio sends every text that parents send to your Bellio number here.
// Set in Twilio: your number → Messaging configuration →
//   "A message comes in": Webhook, https://www.heybellio.com/api/sms, HTTP POST
//
// Handles:
//   STOP / START  → opts that one person out or back in (Twilio sends the confirmation text itself)
//   HELP          → replies with help info
//   INVITE        → replies with the link a co-parent uses to join the household
//   Photo         → reads the flyer and saves its dates, then texts back what it found
//   Anything else → saved, with a friendly reply

import { after } from "next/server";
import { insert, select, update } from "@/lib/db";
import { extractEvents } from "@/lib/extract";
import { saveEvents } from "@/lib/events";
import { dayLabel } from "@/lib/compose";
import { isValidTwilioRequest, sendSms, twiml, twilioAuthHeader } from "@/lib/sms";
import { handleLateArrivals } from "@/lib/reminders";
import {
  FULL_FAMILY_MESSAGE,
  INVITE_DAYS,
  MAX_MEMBERS,
  createInvite,
  findMemberByPhone,
  forwardingAddress,
  getKids,
  getMembers,
  inviteUrl,
} from "@/lib/households";

export const maxDuration = 60;

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"];
const START_WORDS = ["START", "UNSTOP", "YES", "SUBSCRIBE"];
const HELP_WORDS = ["HELP", "INFO"];
const INVITE_WORDS = ["INVITE", "ADD", "COPARENT", "ADDPARENT"];

const HELP_TEXT =
  "Bellio: School reminders by text. Forward school emails to your Bellio address or text us a photo of a flyer. " +
  "Text INVITE to add a co-parent. Questions: hello@heybellio.com. Msg & data rates may apply. Reply STOP to cancel.";

export async function POST(request) {
  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  // 1. Make sure this really came from Twilio.
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL || request.url;
  if (!isValidTwilioRequest(webhookUrl, params, request.headers.get("x-twilio-signature"))) {
    console.warn("Rejected an SMS webhook with a bad Twilio signature. URL checked:", webhookUrl);
    return new Response("Forbidden", { status: 403 });
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();
  const keyword = body.toUpperCase().replace(/[^A-Z]/g, "");
  const optOutType = (params.OptOutType || "").toUpperCase(); // Twilio sets this for STOP/START/HELP

  const member = await findMemberByPhone(from);
  if (member) {
    await insert("messages", {
      household_id: member.household_id,
      member_id: member.id,
      direction: "inbound",
      body,
      twilio_sid: params.MessageSid,
    });
  }

  // 2. Opt-out and opt-in, for this one person only. Twilio sends the confirmation text.
  if (optOutType === "STOP" || STOP_WORDS.includes(keyword)) {
    if (member) await update("members", { id: member.id }, { sms_opted_out: true });
    console.log(`Opt-out from ...${from.slice(-4)}`);
    return twiml();
  }
  if (optOutType === "START" || START_WORDS.includes(keyword)) {
    if (member) await update("members", { id: member.id }, { sms_opted_out: false });
    console.log(`Opt-in from ...${from.slice(-4)}`);
    return twiml();
  }
  if (optOutType === "HELP" || HELP_WORDS.includes(keyword)) {
    return twiml(HELP_TEXT);
  }

  // 3. Someone who hasn't signed up.
  if (!member) {
    return twiml("Bellio: This number sends school reminders to parents who sign up at heybellio.com.");
  }

  const [household] = await select("households", { id: member.household_id });

  // 4. Invite a co-parent: a fresh single-use link, if the family has room.
  if (INVITE_WORDS.includes(keyword)) {
    const members = await getMembers(household.id);
    if (members.length >= MAX_MEMBERS) {
      return twiml(`Bellio: ${FULL_FAMILY_MESSAGE}`);
    }
    const invite = await createInvite(household.id, member.id);
    return twiml(
      `Bellio: Send this link to your co-parent so they get the same reminders: ${inviteUrl(invite)} ` +
        `It works once and expires in ${INVITE_DAYS} days.`
    );
  }

  // 5. A photo of a flyer: read it after replying, since that can take a little while.
  const mediaCount = Number(params.NumMedia || 0);
  if (mediaCount > 0) {
    after(() => processPhotos(member, household, params, mediaCount, body));
    return twiml();
  }

  // 6. Anything else: saved above. A friendly pointer back to how Bellio works.
  return twiml(
    `Bellio: Thanks, got it! To add school info, forward emails to ${forwardingAddress(household)} or text a photo of a flyer. Text INVITE to add a co-parent.`
  );
}

async function processPhotos(member, household, params, mediaCount, caption) {
  try {
    const attachments = [];
    for (let i = 0; i < mediaCount; i++) {
      const url = params[`MediaUrl${i}`];
      const type = (params[`MediaContentType${i}`] || "").toLowerCase();
      if (!url || !type.startsWith("image/")) continue;
      const res = await fetch(url, { headers: { Authorization: twilioAuthHeader() } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      attachments.push({ Name: `photo-${i + 1}`, ContentType: type, Content: buf.toString("base64"), ContentLength: buf.length });
    }

    if (!attachments.length) {
      await sendSms(member, "Bellio: Sorry, I couldn't open that photo. Try sending it again as a regular photo (JPG or PNG).");
      return;
    }

    const [email] = await insert("emails", {
      household_id: household.id,
      source: "sms_photo",
      from_address: params.From,
      subject: `Texted photo from ${member.first_name}`,
      body_text: caption || null,
      attachments: attachments.map((a) => ({ name: a.Name, type: a.ContentType, size: a.ContentLength })),
    });

    const kids = await getKids(household.id);
    const { events } = await extractEvents({
      subject: "Photo of a school flyer texted by a parent",
      from: "Parent (text message)",
      sentAt: new Date().toUTCString(),
      bodyText: caption ? `Parent's note: ${caption}` : "",
      attachments,
      kids,
    });
    const { saved, dupes, merged } = await saveEvents(household.id, email.id, events);
    await update("emails", { id: email.id }, { processed_at: new Date().toISOString() });
    console.log(`Texted photo ${email.id}: saved ${saved.length}, duplicates ${dupes}, merged ${merged}`);

    const nameOf = new Map(kids.map((k) => [k.id, k.first_name]));
    let reply;
    if (saved.length) {
      const list = saved
        .slice(0, 4)
        .map((e) => {
          const who = kids.length > 1 && e.kid_ids?.length && e.kid_ids.length < kids.length
            ? ` (${e.kid_ids.map((id) => nameOf.get(id)).join(" & ")})`
            : "";
          return `• ${dayLabel(e.date)}: ${e.title}${who}`;
        })
        .join("\n");
      const more = saved.length > 4 ? `\n+ ${saved.length - 4} more` : "";
      reply = `Bellio: Got it! Added ${saved.length} date${saved.length > 1 ? "s" : ""}:\n${list}${more}\nI'll text you the night before.`;
    } else if (dupes || merged) {
      reply = "Bellio: Got it! I already had everything on that flyer.";
    } else {
      reply = "Bellio: I couldn't find any dates on that photo. Try a clearer, closer shot of the flyer.";
    }
    await sendSms(member, reply);

    // If the flyer has something for tomorrow (after tonight's text) or today, send it now.
    await handleLateArrivals(household, saved);
  } catch (err) {
    console.error(`Processing texted photo from member ${member.id} failed: ${err.message}`);
  }
}
