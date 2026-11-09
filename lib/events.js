// Saving events, with duplicate detection. Used by both email and texted-photo intake.
//
// Duplicates get caught in two layers:
//   1. The AI is shown the family's already-saved events (existingForPrompt) and
//      told not to repeat them, however they're worded.
//   2. As a backstop, sameEvent() compares dates and titles here in the code.

import { insert, query, update } from "@/lib/db";
import { dayOffKind } from "@/lib/extract";

// Words that don't help tell events apart.
const FILLER = new Set([
  "the", "a", "an", "to", "of", "for", "and", "at", "in", "on", "is", "no", "with", "your", "our",
  "day", "days", "date", "unclear", "tbd", "today", "tomorrow",
]);

// Very light plural handling so "retakes" matches "retake" and "activities" matches "activity".
function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function words(text = "") {
  return new Set(
    text
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w && !FILLER.has(w))
      .map(stem)
  );
}

const isComingUp = (title = "") => /^coming up\b/i.test(title.trim());
const withoutComingUp = (title = "") => title.trim().replace(/^coming up\s*[:\-–]?\s*/i, "");

// The main part of a title: before " + ", ":", "(", or " - ".
// "Matching Monday + canned fruit/veg" -> "Matching Monday"
function core(title = "") {
  return withoutComingUp(title).split(/\s\+\s|\+|:|\(|\s[-–—]\s/)[0];
}

function overlap(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return { shared, ratio: a.size && b.size ? shared / Math.min(a.size, b.size) : 0 };
}

const sameSetOfWords = (a, b) => a.size > 0 && a.size === b.size && [...a].every((w) => b.has(w));

export function sameEvent(a, b) {
  if (a.date !== b.date) return false;
  // A "Coming up" heads-up is never the same as the event itself.
  if (isComingUp(a.title) !== isComingUp(b.title)) return false;

  // Two days off (or two early releases) on the same date are the same day off.
  const kindA = dayOffKind({ title: a.title, action: a.action });
  const kindB = dayOffKind({ title: b.title, action: b.action });
  if (kindA && kindA === kindB) return true;

  // Same main part ("Matching Monday" + anything) = same event.
  const coreA = words(core(a.title));
  const coreB = words(core(b.title));
  if (sameSetOfWords(coreA, coreB)) return true;
  const c = overlap(coreA, coreB);
  if (c.shared >= 2 && c.ratio >= 0.6) return true;

  // Otherwise, the full titles need at least two meaningful words in common.
  const f = overlap(words(withoutComingUp(a.title)), words(withoutComingUp(b.title)));
  return f.shared >= 2 && f.ratio >= 0.6;
}

// Combine two kid lists. An empty list means "whole family", which covers everyone.
function mergeKids(a = [], b = []) {
  if (!a.length || !b.length) return [];
  return [...new Set([...a, ...b])];
}

const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

// The family's already-saved upcoming events, formatted for the AI so it can
// skip repeats. Returns [{ date, title, kids: ["Emma"] }].
export async function existingForPrompt(householdId, kids = []) {
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10);
  const rows = await query(
    "events",
    `household_id=eq.${householdId}&event_date=gte.${today}&event_date=lte.${later}&select=event_date,title,kid_ids&order=event_date`
  );
  const nameOf = new Map(kids.map((k) => [k.id, k.first_name]));
  return rows.slice(0, 120).map((r) => ({
    date: r.event_date,
    title: r.title,
    kids: (r.kid_ids || []).map((id) => nameOf.get(id)).filter(Boolean),
  }));
}

// Saves new events for a family. If an event already exists but this copy is
// for a different child (e.g. both kids have PE that day), that child is added
// to the existing event instead of creating a duplicate.
export async function saveEvents(householdId, emailId, events) {
  if (!events.length) return { saved: [], dupes: 0, merged: 0 };

  const dates = [...new Set(events.map((e) => e.date))].join(",");
  const existing = (
    await query("events", `household_id=eq.${householdId}&event_date=in.(${dates})&select=id,event_date,title,action,kid_ids`)
  ).map((e) => ({ id: e.id, date: e.event_date, title: e.title, action: e.action, kid_ids: e.kid_ids || [] }));

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
