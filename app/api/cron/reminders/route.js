// The nightly reminder job. Vercel runs it every evening (see vercel.json).
// For each household, it finds tomorrow's events, writes one short text
// (grouped by kid when there's more than one), and sends it to every parent
// in the household who's opted in.
//
// Preview in your browser any time, without texting anyone:
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET&date=2026-11-13
//
// Nothing is actually texted unless SMS_SENDING_ENABLED=true in Vercel.

import { query, update } from "@/lib/db";
import { composeMessage } from "@/lib/compose";
import { sendSms, smsEnabled } from "@/lib/sms";
import { getKids, getTextableMembers } from "@/lib/households";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Tomorrow's date (YYYY-MM-DD) in the household's time zone.
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

  const households = await query("households", "subscription_status=neq.canceled&select=*");

  const results = [];
  for (const household of households) {
    const date = dateOverride || tomorrowIn(household.timezone);
    const events = await query(
      "events",
      `household_id=eq.${household.id}&event_date=eq.${date}&reminder_sent_at=is.null&select=*&order=created_at`
    );
    if (!events.length) continue;

    const members = await getTextableMembers(household.id);
    if (!members.length) continue;

    const kids = await getKids(household.id);
    const body = await composeMessage(events, date, kids);
    const result = {
      household: household.inbox_key,
      date,
      events: events.length,
      recipients: members.map((m) => `${m.first_name} (...${m.phone.slice(-4)})`),
      body,
    };

    if (sendForReal) {
      let anySent = false;
      result.errors = [];
      for (const member of members) {
        try {
          const { sent } = await sendSms(member, body);
          anySent = anySent || sent;
        } catch (err) {
          console.error(`Reminder to member ${member.id} failed: ${err.message}`);
          result.errors.push(`${member.first_name}: ${err.message}`);
        }
      }
      result.sent = anySent;
      if (anySent) {
        const now = new Date().toISOString();
        for (const e of events) await update("events", { id: e.id }, { reminder_sent_at: now });
      }
      if (!result.errors.length) delete result.errors;
    } else {
      result.sent = false;
      result.preview = true;
    }
    results.push(result);
  }

  console.log(`Reminder run: ${results.length} household(s) with events, sending ${sendForReal && smsEnabled() ? "on" : "off"}`);
  return Response.json({
    mode: sendForReal ? (smsEnabled() ? "sent" : "dry run (SMS_SENDING_ENABLED is off)") : "preview",
    householdsChecked: households.length,
    messages: results,
  });
}
