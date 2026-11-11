// The nightly reminder job. Vercel runs it every evening (see vercel.json).
// For each family, it finds tomorrow's events, writes one short text (grouped
// by kid when there's more than one), and sends it to every parent who's opted in.
//
// Preview in your browser any time, without texting anyone:
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET
//   https://www.heybellio.com/api/cron/reminders?key=YOUR_CRON_SECRET&date=2026-11-13
//
// Nothing is actually texted unless SMS_SENDING_ENABLED=true in Vercel.

import { query } from "@/lib/db";
import { smsEnabled } from "@/lib/sms";
import { addDays, localNow, sendFamilyReminder } from "@/lib/reminders";
import { recordJobRun } from "@/lib/status";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
  let failures = 0;
  for (const household of households) {
    const date = dateOverride || addDays(localNow(household.timezone).date, 1);
    try {
      const result = await sendFamilyReminder(household, date, "Tomorrow", { sendForReal });
      if (result) results.push(result);
    } catch (err) {
      console.error(`Nightly reminder for family ${household.id} failed: ${err.message}`);
      failures++;
    }
  }

  console.log(`Nightly run: ${results.length} famil(ies) with events, sending ${sendForReal && smsEnabled() ? "on" : "off"}`);
  if (fromVercelCron) {
    // For the daily status report: did it run, and did any texts fail?
    const errors = results.reduce((n, r) => n + (r.errors?.length || 0), 0) + failures;
    await recordJobRun("nightly", { families: results.filter((r) => r.sent).length, errors, sending: smsEnabled() });
  }
  return Response.json({
    mode: sendForReal ? (smsEnabled() ? "sent" : "dry run (SMS_SENDING_ENABLED is off)") : "preview",
    familiesChecked: households.length,
    messages: results,
  });
}
