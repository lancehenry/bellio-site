// The morning catch-up job. Vercel runs it early each morning (see vercel.json).
// It texts any of TODAY's events that haven't been sent yet: usually ones from
// emails that arrived after last night's text went out (Sunday-night newsletters!).
//
// Preview in your browser any time, without texting anyone:
//   https://www.heybellio.com/api/cron/morning?key=YOUR_CRON_SECRET
//   https://www.heybellio.com/api/cron/morning?key=YOUR_CRON_SECRET&date=2026-11-09
//
// Nothing is actually texted unless SMS_SENDING_ENABLED=true in Vercel.

import { query } from "@/lib/db";
import { smsEnabled } from "@/lib/sms";
import { localNow, sendFamilyReminder } from "@/lib/reminders";

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

  const sendForReal = fromVercelCron || url.searchParams.get("send") === "1";
  const dateOverride = url.searchParams.get("date");
  if (dateOverride && !/^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
    return Response.json({ error: "date must look like 2026-11-09" }, { status: 400 });
  }

  const households = await query("households", "subscription_status=neq.canceled&select=*");
  const results = [];
  for (const household of households) {
    const date = dateOverride || localNow(household.timezone).date;
    try {
      const result = await sendFamilyReminder(household, date, "Today", { sendForReal });
      if (result) results.push(result);
    } catch (err) {
      console.error(`Morning catch-up for family ${household.id} failed: ${err.message}`);
    }
  }

  console.log(`Morning catch-up: ${results.length} famil(ies) with unsent items, sending ${sendForReal && smsEnabled() ? "on" : "off"}`);
  return Response.json({
    mode: sendForReal ? (smsEnabled() ? "sent" : "dry run (SMS_SENDING_ENABLED is off)") : "preview",
    familiesChecked: households.length,
    messages: results,
  });
}
