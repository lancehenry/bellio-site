// The nightly reminder job. Vercel runs it every evening (see vercel.json).
// For each parent, it finds tomorrow's events, writes one short text, and sends it.
//
// Preview in your browser any time, without texting anyone:
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET&date=2026-11-13
//
// Nothing is actually texted unless SMS_SENDING_ENABLED=true in Vercel.

import { query, update } from "@/lib/db";
import { composeMessage } from "@/lib/compose";
import { sendSms, smsEnabled } from "@/lib/sms";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Tomorrow's date (YYYY-MM-DD) in the parent's own time zone.
function tomorrowIn(timeZone) {
  let today;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  }
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const fromVercelCron = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  const fromBrowser = !!secret && url.searchParams.get("key") === secret;
  if (!fromVercelCron && !fromBrowser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Browser visits only preview, unless you add &send=1 on purpose.
  const sendForReal = fromVercelCron || url.searchParams.get("send") === "1";
  const dateOverride = url.searchParams.get("date");
  if (dateOverride && !/^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
    return Response.json({ error: "date must look like 2026-11-13" }, { status: 400 });
  }

  const parents = (
    await query("parents", "sms_consent=eq.true&sms_opted_out=eq.false&select=*")
  ).filter((p) => p.subscription_status !== "canceled");

  const results = [];
  for (const parent of parents) {
    const date = dateOverride || tomorrowIn(parent.timezone);
    const events = await query(
      "events",
      `parent_id=eq.${parent.id}&event_date=eq.${date}&reminder_sent_at=is.null&select=*&order=created_at`
    );
    if (!events.length) continue;

    const kids = await query("kids", `parent_id=eq.${parent.id}&select=first_name`);
    const body = await composeMessage(events, date, kids);
    const result = { parent: parent.first_name, phone: `...${parent.phone.slice(-4)}`, date, events: events.length, body };

    if (sendForReal) {
      try {
        const { sent } = await sendSms(parent, body);
        result.sent = sent;
        if (sent) {
          const now = new Date().toISOString();
          for (const e of events) await update("events", { id: e.id }, { reminder_sent_at: now });
        }
      } catch (err) {
        console.error(`Reminder to parent ${parent.id} failed: ${err.message}`);
        result.error = err.message;
      }
    } else {
      result.sent = false;
      result.preview = true;
    }
    results.push(result);
  }

  console.log(`Reminder run: ${results.length} parent(s) with events, sending ${sendForReal && smsEnabled() ? "on" : "off"}`);
  return Response.json({
    mode: sendForReal ? (smsEnabled() ? "sent" : "dry run (SMS_SENDING_ENABLED is off)") : "preview",
    parentsChecked: parents.length,
    messages: results,
  });
}
