// Postmark sends every email that arrives at *@inbox.heybellio.com here.
// We figure out which parent it belongs to, save it, ask Claude for the
// dates and to-dos, and save those as events.
//
// Postmark webhook URL (set in Postmark → Default Inbound Stream → Settings):
//   https://heybellio.com/api/inbound?token=YOUR_INBOUND_WEBHOOK_SECRET

import { insert, select, update } from "@/lib/db";
import { extractEvents } from "@/lib/extract";

export const maxDuration = 60; // give Claude time to read long PDFs

const INBOUND_DOMAIN = (process.env.INBOUND_DOMAIN || "inbox.heybellio.com").toLowerCase();

// Collect every address the email was sent to and return the parent's inbox key.
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

  // 2. Which parent is this for?
  const inboxKey = findInboxKey(msg);
  if (!inboxKey) {
    console.log("Inbound email with no matching inbox address:", msg.To);
    return ok({ ignored: "no inbox address" });
  }

  const [parent] = await select("parents", { inbox_key: inboxKey });
  if (!parent) {
    console.log("Inbound email for unknown inbox key:", inboxKey);
    return ok({ ignored: "unknown parent" });
  }

  const fromAddress = (msg.FromFull?.Email || msg.From || "").toLowerCase();
  const bodyText = msg.TextBody?.trim() || htmlToText(msg.HtmlBody);
  const attachments = msg.Attachments || [];

  // 3. Save the raw email (attachment names only, not the files themselves).
  const [email] = await insert("emails", {
    parent_id: parent.id,
    source: "email",
    from_address: fromAddress,
    subject: msg.Subject || null,
    body_text: bodyText.slice(0, 100000),
    attachments: attachments.map((a) => ({ name: a.Name, type: a.ContentType, size: a.ContentLength })),
  });

  // 4. Gmail sends a confirmation code before it will auto-forward.
  //    Save it and skip the AI. (Later we'll text the code to the parent.)
  if (fromAddress === "forwarding-noreply@google.com") {
    const code = (bodyText.match(/confirmation code:\s*(\d+)/i) || [])[1];
    console.log(`Gmail forwarding confirmation for parent ${parent.id}: code ${code || "not found"}`);
    await update("emails", { id: email.id }, { processed_at: new Date().toISOString() });
    return ok({ gmailConfirmation: true });
  }

  // 5. Ask Claude for the dates and to-dos.
  try {
    const kids = await select("kids", { parent_id: parent.id }, "first_name,grade,school");
    const { events, skipped } = await extractEvents({
      subject: msg.Subject,
      from: msg.From,
      sentAt: msg.Date || new Date().toUTCString(),
      bodyText,
      attachments,
      kids,
    });

    if (events.length) {
      await insert(
        "events",
        events.map((e) => ({
          parent_id: parent.id,
          email_id: email.id,
          event_date: e.date,
          title: e.title.trim(),
          action: e.action?.trim() || null,
          applies_to: e.applies_to?.trim() || null,
          date_unclear: !!e.date_unclear,
        }))
      );
    }

    await update("emails", { id: email.id }, { processed_at: new Date().toISOString() });
    console.log(`Email ${email.id}: saved ${events.length} event(s)` + (skipped.length ? `, skipped attachments: ${skipped.join(", ")}` : ""));
    return ok({ events: events.length });
  } catch (err) {
    // The email is saved, so nothing is lost. processed_at stays empty so you can find and retry it.
    console.error(`Email ${email.id}: extraction failed`, err);
    return ok({ extractionFailed: true });
  }
}
