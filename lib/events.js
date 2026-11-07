// Saving events, with duplicate detection. Used by both email and texted-photo intake.

import { insert, query } from "@/lib/db";

// Parents forward the same email twice, or schools repeat dates across emails.
// Two events are treated as the same if they're on the same date and their
// titles share most of their words ("Field trip to the Coterie" vs
// "Coterie Theater field trip").
const STOP_WORDS = new Set(["the", "a", "an", "to", "of", "for", "and", "at", "in", "on", "is", "no"]);

function titleWords(title = "") {
  return new Set(
    title
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w && !STOP_WORDS.has(w))
  );
}

export function sameEvent(a, b) {
  if (a.date !== b.date) return false;
  const wa = titleWords(a.title);
  const wb = titleWords(b.title);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

// Saves new events for a parent, skipping duplicates. Returns what was saved.
export async function saveEvents(parentId, emailId, events) {
  if (!events.length) return { saved: [], dupes: 0 };

  const dates = [...new Set(events.map((e) => e.date))].join(",");
  const existing = (
    await query("events", `parent_id=eq.${parentId}&event_date=in.(${dates})&select=event_date,title`)
  ).map((e) => ({ date: e.event_date, title: e.title }));

  const fresh = [];
  for (const e of events) {
    if (![...existing, ...fresh].some((x) => sameEvent(x, e))) fresh.push(e);
  }

  if (fresh.length) {
    await insert(
      "events",
      fresh.map((e) => ({
        parent_id: parentId,
        email_id: emailId,
        event_date: e.date,
        title: e.title.trim(),
        action: e.action?.trim() || null,
        applies_to: e.applies_to?.trim() || null,
        date_unclear: !!e.date_unclear,
      }))
    );
  }
  return { saved: fresh, dupes: events.length - fresh.length };
}
