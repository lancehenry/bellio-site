// A family's upcoming reminders, for the Manage Family "Coming up" list and the
// WEEK text. Reminders a parent dismissed are left out.

import { query } from "@/lib/db";
import { dayLabel } from "@/lib/compose";
import { addDays, localNow } from "@/lib/reminders";

export const HEADS_UP_RE = /^coming up:/i;

// Who a reminder is for, in words: "Emma", "Emma & Jack", or "" for the whole family.
export function whoFor(event, kids) {
  if (kids.length < 2) return "";
  const nameOf = new Map(kids.map((k) => [k.id, k.first_name]));
  const ids = (event.kid_ids || []).filter((id) => nameOf.has(id));
  if (!ids.length || ids.length === kids.length) return "";
  const order = kids.map((k) => k.id);
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => nameOf.get(id)).join(" & ");
}

export async function getUpcoming(household, kids, days = 30) {
  const today = localNow(household.timezone).date;
  const last = addDays(today, days - 1);
  const rows = await query(
    "events",
    `household_id=eq.${household.id}&event_date=gte.${today}&event_date=lte.${last}&dismissed_at=is.null` +
      `&select=id,event_date,title,action,kid_ids,reminder_sent_at&order=event_date,created_at&limit=100`
  );
  return rows.map((e) => ({
    id: e.id,
    date: e.event_date,
    day: dayLabel(e.event_date),
    title: e.title,
    action: e.action || "",
    who: whoFor(e, kids),
    headsUp: HEADS_UP_RE.test(e.title),
    texted: !!e.reminder_sent_at,
  }));
}

// The reply to WEEK: the next 7 days, one line per item, kept to about 3 texts.
export function weekText(items) {
  const real = items.filter((i) => !i.headsUp);
  if (!real.length) {
    return "Bellio: Nothing on the calendar for the next 7 days. Forward school emails anytime and I'll keep watch.";
  }
  const lines = [];
  let lastDay = "";
  for (const i of real) {
    if (i.day !== lastDay) {
      lines.push(`${i.day}:`);
      lastDay = i.day;
    }
    lines.push(`- ${i.title}${i.who ? ` (${i.who})` : ""}`);
  }
  let body = lines.join("\n");
  const max = 420;
  if (body.length > max) {
    const kept = [];
    let len = 0;
    for (const l of lines) {
      if (len + l.length + 1 > max) break;
      kept.push(l);
      len += l.length + 1;
    }
    if (kept.length && kept.at(-1).endsWith(":")) kept.pop();
    const shown = kept.filter((l) => l.startsWith("- ")).length;
    body = `${kept.join("\n")}\n+ ${real.length - shown} more`;
  }
  return `Bellio: Next 7 days\n${body}\nSee or remove items: text SETTINGS.`;
}
