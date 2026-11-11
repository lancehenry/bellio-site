// Postmark sends every email that arrives at *@inbox.heybellio.com here.
// We figure out which household it belongs to, save it, ask Claude for the
// dates and to-dos, and save those as events.
//
// Postmark webhook URL (set in Postmark → Default Inbound Stream → Settings):
//   https://www.heybellio.com/api/inbound?token=YOUR_INBOUND_WEBHOOK_SECRET

import { after } from "next/server";
import { insert, select, update } from "@/lib/db";
import { extractEvents } from "@/lib/extract";
import { existingForPrompt, saveEvents } from "@/lib/events";
import { getKids, getTextableMembers } from "@/lib/households";
import { sendSms } from "@/lib/sms";
import { handleLateArrivals } from "@/lib/reminders";
import { LIMITS, overLimit } from "@/lib/protect";

// Newsletters with many flyers and calendars can take a minute or more for the AI to read.
// We reply to Postmark right away and keep working in the background for up to 5 minutes.
export const maxDuration = 300;

const INBOUND_DOMAIN = (process.env.INBOUND_DOMAIN || "inbox.heybellio.com").toLowerCase();

// Collect every address the email was sent to and return the household's inbox key.
function findInboxKey(msg) {
  const addresses = [
    msg.OriginalRecipient,
    ...(msg.ToFull || []).map((r) => r.Email),
    ...(msg.CcFull || []).map((r) => r.Email),
    ...(msg.BccFull || []).map((r) => r.Email),
  ].filter(Boolean);

  for (const addr of addresses) {
    const [local, domain] = String(addr).toLowerCase().trim().split("@");
    if (domain === INBOUND_DOMAIN && local) {
      return local.split("+")[0]; // ignore any +tag
    }
  }
  return null;
}

function htmlToText(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

// Always answer 200 once we've handled (or deliberately ignored) an email,
// so Postmark doesn't keep retrying it.
const ok = (extra = {}) => Response.json({ ok: true, ...extra });

export async function POST(request) {
  // 1. Make sure the request really came from your Postmark webhook.
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  const token = new URL(request.url).searchParams.get("token");
  if (!secret || token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let msg;
  try {
    msg = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Which household is this for?
  const inboxKey = findInboxKey(msg);
  if (!inboxKey) {
    console.log("Inbound email with no matching inbox address:", msg.To);
    return ok({ ignored: "no inbox address" });
  }

  const [household] = await select("households", { inbox_key: inboxKey });
  if (!household) {
    console.log("Inbound email for unknown inbox key:", inboxKey);
    return ok({ ignored: "unknown household" });
  }

  // A real family forwards a handful of emails a day. Far more than that is
  // a forwarding loop or abuse, and each email costs an AI call.
  if (await overLimit(LIMITS.emailsPerFamily, household.id)) {
    console.warn(`Family ${household.id} hit the daily email limit; ignoring this one.`);
    return ok({ ignored: "daily email limit" });
  }

  const fromAddress = (msg.FromFull?.Email || msg.From || "").toLowerCase();
  const bodyText = msg.TextBody?.trim() || htmlToText(msg.HtmlBody);
  const attachments = msg.Attachments || [];

  // 3. Save the raw email (attachment names only, not the files themselves).
  const [email] = await insert("emails", {
    household_id: household.id,
    source: "email",
    from_address: fromAddress,
    subject: msg.Subject || null,
    body_text: bodyText.slice(0, 100000),
    attachments: attachments.map((a) => ({ name: a.Name, type: a.ContentType, size: a.ContentLength })),
  });

  // 4. Gmail sends a confirmation code before it will auto-forward.
  //    Text the code to the household so they can finish setup, and skip the AI.
  if (fromAddress === "forwarding-noreply@google.com") {
    const code = (bodyText.match(/confirmation code:\s*(\d+)/i) || [])[1];
    console.log(`Gmail forwarding confirmation for household ${household.id}: code ${code || "not found"}`);
    await update("emails", { id: email.id }, { processed_at: new Date().toISOString() });
    if (code) {
      try {
        for (const member of await getTextableMembers(household.id)) {
          await sendSms(member, `Bellio: Your Gmail forwarding code is ${code}. Type it into the Verify box in Gmail's forwarding settings, then create your filter (steps: heybellio.com/setup).`);
        }
      } catch (err) {
        console.error(`Texting Gmail code failed: ${err.message}`);
      }
    }
    return ok({ gmailConfirmation: true });
  }

  // 5. Ask Claude for the dates and to-dos, after telling Postmark we've got the email.
  after(() => processEmail(email, household, msg, bodyText, attachments));
  return ok({ queued: true });
}

async function processEmail(email, household, msg, bodyText, attachments) {
  const started = Date.now();
  try {
    const kids = await getKids(household.id);
    const { events, skipped } = await extractEvents({
      subject: msg.Subject,
      from: msg.From,
      sentAt: msg.Date || new Date().toUTCString(),
      bodyText,
      htmlBody: msg.HtmlBody,
      attachments,
      kids,
      existing: await existingForPrompt(household.id, kids),
    });

    const { saved: fresh, dupes, merged } = await saveEvents(household.id, email.id, events);

    await update("emails", { id: email.id }, { processed_at: new Date().toISOString() });
    console.log(
      `Email ${email.id}: saved ${fresh.length} event(s)` +
        (dupes ? `, skipped ${dupes} duplicate(s)` : "") +
        (merged ? `, added a child to ${merged} existing event(s)` : "") +
        (skipped.length ? `, skipped attachments: ${skipped.join(", ")}` : "") +
        ` (${Math.round((Date.now() - started) / 1000)}s)`
    );

    // If this email came in after tonight's text (or has something for today), send it now.
    await handleLateArrivals(household, fresh);
  } catch (err) {
    // The email is saved, so nothing is lost. processed_at stays empty so you can find and retry it.
    console.error(`Email ${email.id}: extraction failed - ${err.message}`);
  }
}
