// Saving events, with duplicate detection. Used by both email and texted-photo intake.

import { insert, query, update } from "@/lib/db";

// Parents forward the same email twice, co-parents both forward it, or schools
// repeat dates across emails. Two events are treated as the same if they're on
// the same date and their titles share most of their words
// ("Field trip to the Coterie" vs "Coterie Theater field trip").
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

// Combine two kid lists. An empty list means "whole family", which covers everyone.
function mergeKids(a = [], b = []) {
  if (!a.length || !b.length) return [];
  return [...new Set([...a, ...b])];
}

const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

// Saves new events for a household. If an event already exists but this copy is
// for a different child (e.g. both kids have PE that day), that child is added
// to the existing event instead of creating a duplicate.
export async function saveEvents(householdId, emailId, events) {
  if (!events.length) return { saved: [], dupes: 0, merged: 0 };

  const dates = [...new Set(events.map((e) => e.date))].join(",");
  const existing = (
    await query("events", `household_id=eq.${householdId}&event_date=in.(${dates})&select=id,event_date,title,kid_ids`)
  ).map((e) => ({ id: e.id, date: e.event_date, title: e.title, kid_ids: e.kid_ids || [] }));

  const fresh = [];
  let dupes = 0;
  let merged = 0;

  for (const e of events) {
    const kids = e.kid_ids || [];

    // Same event already in this batch? Fold this child in.
    const inBatch = fresh.find((x) => sameEvent(x, e));
    if (inBatch) {
      inBatch.kid_ids = mergeKids(inBatch.kid_ids, kids);
      dupes++;
      continue;
    }

    // Same event already saved? Add the child if they're new to it.
    const match = existing.find((x) => sameEvent(x, e));
    if (match) {
      const combined = mergeKids(match.kid_ids, kids);
      if (!sameSet(combined, match.kid_ids)) {
        await update("events", { id: match.id }, { kid_ids: combined });
        match.kid_ids = combined;
        merged++;
      } else {
        dupes++;
      }
      continue;
    }

    fresh.push({ ...e, kid_ids: kids });
  }

  if (fresh.length) {
    await insert(
      "events",
      fresh.map((e) => ({
        household_id: householdId,
        email_id: emailId,
        kid_ids: e.kid_ids,
        event_date: e.date,
        title: e.title.trim(),
        action: e.action?.trim() || null,
        applies_to: e.applies_to?.trim() || null,
        date_unclear: !!e.date_unclear,
      }))
    );
  }
  return { saved: fresh, dupes, merged };
}
