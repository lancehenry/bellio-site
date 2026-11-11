// The daily status report: a short text to you (ADMIN_PHONE) each morning, so you
// find out when something breaks without watching the Vercel logs.
// Also viewable any time in your browser:
//   https://www.heybellio.com/api/admin/status?key=YOUR_CRON_SECRET

import { insert, query } from "@/lib/db";
import { localNow } from "@/lib/reminders";

const iso = (msAgo) => encodeURIComponent(new Date(Date.now() - msAgo).toISOString());
const HOUR = 3600 * 1000;
const count = async (table, filters) => (await query(table, `${filters}&select=id&limit=10000`)).length;

// Records that a scheduled job ran (only for the real Vercel runs, not previews).
export async function recordJobRun(name, summary) {
  try {
    await insert("job_runs", { name, summary });
  } catch (err) {
    console.error(`Recording the ${name} job run failed: ${err.message}`);
  }
}

function ago(ts) {
  const h = (Date.now() - Date.parse(ts)) / HOUR;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : `${Math.round(h)} hr ago`;
}

// Gathers the last 24 hours. `cleanup` is this morning's bellio_purge result, if any.
export async function buildStatus({ cleanup } = {}) {
  const day = iso(24 * HOUR);
  const [
    families,
    newFamilies,
    newAdults,
    emails,
    stuckEmails,
    events,
    textsOut,
    textsIn,
    optOuts,
    [nightly],
  ] = await Promise.all([
    count("households", "subscription_status=neq.canceled"),
    count("households", `created_at=gte.${day}`),
    count("members", `created_at=gte.${day}`),
    count("emails", `created_at=gte.${day}`),
    // Not finished within 30 minutes = the AI step failed. (Looks back 2 days.)
    query("emails", `processed_at=is.null&created_at=lt.${iso(0.5 * HOUR)}&created_at=gte.${iso(48 * HOUR)}&select=id,source,created_at&limit=20`),
    count("events", `created_at=gte.${day}`),
    count("messages", `direction=eq.outbound&created_at=gte.${day}`),
    count("messages", `direction=eq.inbound&created_at=gte.${day}`),
    // Parents who chose to stop texts (not number changes or removals).
    count("consent_events", `event=eq.opt_out&source=in.(sms_reply,web_settings)&created_at=gte.${day}`),
    query("job_runs", "name=eq.nightly&select=ran_at,summary&order=ran_at.desc&limit=1"),
  ]);

  const problems = [];
  if (!nightly) problems.push("Nightly job hasn't run yet");
  else if (Date.now() - Date.parse(nightly.ran_at) > 26 * HOUR) problems.push(`Nightly job last ran ${ago(nightly.ran_at)}`);
  const nightlyErrors = nightly?.summary?.errors || 0;
  if (nightlyErrors) problems.push(`${nightlyErrors} nightly text${nightlyErrors > 1 ? "s" : ""} failed`);
  if (stuckEmails.length) problems.push(`${stuckEmails.length} email${stuckEmails.length > 1 ? "s" : ""} not read (AI step failed)`);
  if (cleanup?.error) problems.push("Daily cleanup failed");

  return {
    ok: problems.length === 0,
    problems,
    families,
    newFamilies,
    newAdults,
    emails,
    stuckEmails: stuckEmails.map((e) => ({ id: e.id, source: e.source, at: e.created_at })),
    remindersSaved: events,
    textsSent: textsOut,
    repliesReceived: textsIn,
    optOuts,
    nightly: nightly ? { ranAt: nightly.ran_at, ...nightly.summary } : null,
  };
}

export function statusText(s) {
  const today = localNow("America/Chicago").date.split("-").map(Number);
  const lines = [
    `Bellio daily ${today[1]}/${today[2]}: ${s.ok ? "all good" : "needs a look"}`,
    ...s.problems.map((p) => `! ${p}`),
    `Families: ${s.families}${s.newFamilies ? ` (+${s.newFamilies} new)` : ""}${s.newAdults ? `, +${s.newAdults} adult${s.newAdults > 1 ? "s" : ""}` : ""}`,
    `Emails/photos in: ${s.emails}, reminders saved: ${s.remindersSaved}`,
    `Texts: ${s.textsSent} sent, ${s.repliesReceived} replies, ${s.optOuts} opt-out${s.optOuts === 1 ? "" : "s"}`,
    s.nightly ? `Nightly: ran ${ago(s.nightly.ranAt)}, ${s.nightly.families ?? 0} famil${s.nightly.families === 1 ? "y" : "ies"} texted` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
