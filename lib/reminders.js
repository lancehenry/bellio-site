// Sending a family's reminder text for a given day. Used by:
//   - the nightly job ("Tomorrow"), app/api/cron/reminders
//   - the morning catch-up job ("Today"), app/api/cron/morning
//   - late arrivals: emails or photos that come in after the nightly text has gone out

import { query, update } from "@/lib/db";
import { composeMessage } from "@/lib/compose";
import { sendSms } from "@/lib/sms";
import { getKids, getTextableMembers } from "@/lib/households";

// Today's date (YYYY-MM-DD) and the hour/minute in the family's time zone.
export function localNow(timeZone) {
  const zone = (() => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return timeZone;
    } catch {
      return "America/Chicago";
    }
  })();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Composes and (if sendForReal) sends one family's text for `date`.
// `when` is "Tomorrow" or "Today". Returns a summary, or null if there was nothing to send.
export async function sendFamilyReminder(household, date, when, { sendForReal }) {
  const events = await query(
    "events",
    `household_id=eq.${household.id}&event_date=eq.${date}&reminder_sent_at=is.null&dismissed_at=is.null&select=*&order=created_at`
  );
  if (!events.length) return null;

  const members = await getTextableMembers(household.id);
  if (!members.length) return null;

  const kids = await getKids(household.id);
  const body = await composeMessage(events, date, kids, when);
  const result = {
    household: household.inbox_key,
    date,
    when,
    events: events.length,
    recipients: members.map((m) => `${m.first_name} (...${m.phone.slice(-4)})`),
    body,
  };

  if (!sendForReal) return { ...result, sent: false, preview: true };

  let anySent = false;
  const errors = [];
  for (const member of members) {
    try {
      const { sent } = await sendSms(member, body);
      anySent = anySent || sent;
    } catch (err) {
      console.error(`Reminder to member ${member.id} failed: ${err.message}`);
      errors.push(`${member.first_name}: ${err.message}`);
    }
  }
  if (anySent) {
    const now = new Date().toISOString();
    for (const e of events) await update("events", { id: e.id }, { reminder_sent_at: now });
  }
  return { ...result, sent: anySent, ...(errors.length ? { errors } : {}) };
}

// Called right after new events are saved from an email or texted photo.
// If they'd otherwise miss their reminder, send it now:
//   8:00pm–9:30pm  → events for tomorrow (the nightly text has already gone out)
//   6:00am–2:00pm  → events for today (e.g. a snow-day email)
// Anything that arrives later at night is picked up by the morning catch-up job.
export async function handleLateArrivals(household, savedEvents) {
  if (!savedEvents?.length) return null;
  const { date: today, hour, minute } = localNow(household.timezone);
  const time = hour + minute / 60;
  const tomorrow = addDays(today, 1);

  let target = null;
  if (time >= 20 && time < 21.5 && savedEvents.some((e) => e.date === tomorrow)) {
    target = { date: tomorrow, when: "Tomorrow" };
  } else if (time >= 6 && time < 14 && savedEvents.some((e) => e.date === today)) {
    target = { date: today, when: "Today" };
  }
  if (!target) return null;

  try {
    const result = await sendFamilyReminder(household, target.date, target.when, { sendForReal: true });
    if (result) console.log(`Late arrival for family ${household.id}: sent "${target.when}" text for ${target.date}`);
    return result;
  } catch (err) {
    console.error(`Late-arrival text for family ${household.id} failed: ${err.message}`);
    return null;
  }
}
