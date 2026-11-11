// Sends a school email (plus any PDF/image attachments) to Claude and gets back
// a clean list of dated events and to-dos.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { dayLabel } from "@/lib/compose";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // skip PDFs over ~5 MB
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;    // Claude's per-image limit, with headroom
const MIN_IMAGE_BYTES = 3000;                 // smaller = logos, spacers, tracking pixels
const MAX_LINKED_IMAGES = 15;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const SKIP_IMAGE_WORDS = /app ?store|google ?play|logo|icon|badge|pixel|spacer|track|avatar|social|facebook|instagram|twitter/i;
// Image descriptions (alt text) that usually mean dates and details: read these first.
const USEFUL_IMAGE_WORDS = /calendar|schedule|flyer|date|event|menu|chart|deadline|reminder|sign.?up|fair|spirit|field trip|dismissal|conference|no school|lunch|invit|week|month|time/i;
// Ones that usually mean decoration: read these last, only if there's room.
const DECORATIVE_IMAGE_WORDS = /banner|title card|portrait|headshot|photo of|qr code|celebrat|appreciation|spotlight|stethoscope|wordmark|prohibition|clip ?art|hand-drawn|illustrated|header/i;

const SYSTEM_PROMPT = `You read school communications for busy parents: district emails, teacher newsletters, PTA messages, ParentSquare/Remind posts, and photos of paper flyers.

Pull out every date-specific item a parent needs to know or act on: early release or no-school days, picture day, spirit/dress-up days, field trips, money or forms due, things to bring, events families are invited to, deadlines.

Rules:
- Only include items tied to a specific date (or a date you can work out, like "next Friday"). Skip general news, reminders with no date, and anything purely informational.
- Resolve relative dates ("this Thursday", "next week Monday") using the date the email was sent. Assume the school year that makes sense for that sent date.
- Weekend emails: newsletters are often written on Friday and sent over the weekend. If the email was sent on a Saturday or Sunday, "this week", "next week", and "the week ahead" all mean the school week starting the following Monday, unless the email clearly says otherwise.
- Time window: only include events from the day the email was sent through the next 60 days. Skip anything further out, even if it appears on a calendar; it will come up again in a later email.
- Never invent to-dos. Every action must come from what the email actually says. Don't add permission slips, chaperones, money, sign-ups, or "check with the teacher" unless the email mentions them. If the email gives nothing to do, leave the action empty.
- Skip standing policy fine print that repeats in every newsletter and isn't a real upcoming event (meal account collection dates, attendance rules, "repeat information" sections), unless it asks every family to do something by a specific date.
- Read every image carefully. Flyers often hold the important details (daily spirit-week themes, items to donate, times, costs). Use those details in your events.
- If an item spans several days (e.g. spirit week), create one event per day that has its own instructions (e.g. "Pajama day: wear pajamas"), or one event on the first day if every day is the same.
- Advance notice for events: if the email says an event needs preparation ahead of time (signing up, filling out a form, buying or sending items, RSVPing) and no deadline is given, ALSO create a separate event 7 days before it titled "Coming up: <event> (<M/D>)" whose action lists only the prep the email mentions. Skip this if the event is less than 7 days after the email was sent.
- Don't create "Coming up" events for no-school days, breaks, or early releases; Bellio adds those heads-ups automatically.
- Multi-day breaks: create one event on the first day off, and set end_date to the last day off (e.g. Thanksgiving Break 11/24-11/27 → date 2026-11-24, end_date 2026-11-27). Use the calendar to find the last day if the text only says when it begins.
- Advance notice for deadlines: if something is due by a date and getting it ready takes effort (a document from a doctor, a form, money, a purchase, a sign-up), create the deadline event AND an earlier event titled "Coming up: <thing> due <M/D>": 3 days before the deadline, or, if that's on or before the day the email was sent, the day after the email was sent. Skip the earlier event if it would land on or after the deadline.
- Conditional items: if an item only applies in some cases (only if not already turned in, only if a veteran is attending, only for students who need retakes, only if you signed up), start the action with that condition, e.g. "If not turned in yet: get the physical to Nurse Clark" or "If a veteran is attending: RSVP by noon".
- Specials schedules: if the email lists a specials/rotation schedule for a specific week (e.g. "Next week: Monday Music & PE, Tuesday Library"), create an event for each day where parents typically need to do something: PE → "Wear sneakers"; Library → "Return library books". Skip days with nothing to do (Art, Music) unless the email says to bring something.
- If a date is genuinely ambiguous, give your best guess and set date_unclear to true.
- Keep titles short (2-6 words) and actions concrete ("Send $5 in an envelope", "Wear a collared shirt"). Leave action empty if there's nothing to do.
- applies_to says who it's for: "Whole school", "3rd grade", "Mrs. Lee's class", a child's name, etc.
- Calendars: from monthly calendars, include what families need to plan around: no-school days, early release, conferences, school-wide events, deadlines, and events for the children's grades. Skip club meetings, practices, and staff-only events unless the email says the children are part of them. Keep each event's action brief.
- Skip items that only apply to grades, classes, or schools none of the family's children are in (e.g. a 5th grade field trip when the children are in K and 3rd). When the children aren't listed, include everything.
- for_kids: if the family has more than one child (listed in the message), list the first names of the child or children each event applies to, using the grade, teacher, class, and school to decide. A whole-school event lists every child at that school. Use an empty list only for events meant for the whole family. If the family has one child or none listed, always use an empty list.
- Already saved: the message may list events this family already has. Don't repeat any of them, even if this email words them differently (e.g. "Matching Monday + food drive" is the same as "Matching Monday + canned fruit/veg"). Only if this email shows an already-saved event also applies to another child, repeat it with exactly the same date and title and list that child in for_kids.
- If there is nothing date-specific, return an empty list.

Always respond by calling the save_events tool, even when the list is empty. Do not reply with plain text.`;

const TOOL = {
  name: "save_events",
  description: "Save the date-specific items found in the school communication.",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            title: { type: "string" },
            action: { type: "string", description: "What the parent needs to do or send. Empty if nothing." },
            applies_to: { type: "string" },
            date_unclear: { type: "boolean" },
            for_kids: {
              type: "array",
              items: { type: "string" },
              description: "First names of the children this applies to. Empty = whole family.",
            },
            end_date: {
              type: "string",
              description:
                "YYYY-MM-DD. For multi-day items like breaks (Thanksgiving, winter, spring), the LAST day off. Otherwise the same as date.",
            },
          },
          required: ["date", "title", "action", "applies_to", "date_unclear", "for_kids"],
        },
      },
    },
    required: ["events"],
  },
};

function attachmentBlocks(attachments = []) {
  const blocks = [];
  const skipped = [];
  for (const a of attachments) {
    const type = (a.ContentType || "").toLowerCase().split(";")[0];
    const size = a.ContentLength || Math.floor(((a.Content || "").length * 3) / 4);
    // Skip empty files, huge files, and tiny images (logos, spacers, tracking pixels).
    const isImage = IMAGE_TYPES.includes(type);
    const badImageSize = isImage && (size < MIN_IMAGE_BYTES || size > MAX_IMAGE_BYTES);
    if (!a.Content || size > MAX_ATTACHMENT_BYTES || badImageSize) {
      skipped.push(a.Name);
      continue;
    }
    if (type === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.Content } });
    } else if (IMAGE_TYPES.includes(type)) {
      blocks.push({ type: "image", source: { type: "base64", media_type: type, data: a.Content } });
    } else {
      skipped.push(a.Name);
    }
  }
  return { blocks, skipped };
}

// Many school emails (ParentSquare, Smore, Mailchimp) link flyer images instead of
// attaching them. Find those images in the email's HTML and download them.
export function findLinkedImages(html = "") {
  const found = [];
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    // Match the opening quote type, so an apostrophe inside a description doesn't cut it short.
    const attr = (name) => {
      const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
      return m ? (m[1] ?? m[2] ?? "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"') : "";
    };
    const src = attr("src");
    if (!src || !/^https?:\/\//i.test(src)) continue;
    const url = src;
    const alt = attr("alt");
    const width = Number((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1]);
    const height = Number((tag.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1]);
    if ((width && width < 80) || (height && height < 80)) continue; // icons and pixels
    if (SKIP_IMAGE_WORDS.test(alt) || SKIP_IMAGE_WORDS.test(url)) continue;
    if (found.some((f) => f.url === url)) continue;
    // Calendars and flyers first, decorations last; otherwise keep the email's order.
    const useful = USEFUL_IMAGE_WORDS.test(alt);
    const decorative = DECORATIVE_IMAGE_WORDS.test(alt);
    const score = useful && !decorative ? 2 : !decorative ? 1 : useful ? 1 : 0;
    found.push({ url, alt, score, order: found.length });
  }
  return found
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_LINKED_IMAGES)
    .sort((a, b) => a.order - b.order); // send them to the AI in reading order
}

export const findLinkedImageUrls = (html) => findLinkedImages(html).map((i) => i.url);

// --- Safe image downloads ------------------------------------------------------
// Image links come from emails anyone could send, so only fetch ordinary public
// web addresses: never Vercel's own network, the local machine, or private ranges.
// Each redirect is checked the same way, and downloads stop at the size limit.

function isPrivateIp(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export async function isSafeImageUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return false;
  if (u.port && !["80", "443"].includes(u.port)) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) return false; // real image hosts use names, not raw IP addresses
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|localdomain|home|lan|corp)$/.test(host)) return false;
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && !addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return false;
  }
}

async function downloadImage(url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await isSafeImageUrl(current))) return null;
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return null;
      current = new URL(next, current).toString();
      continue;
    }
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    if (!IMAGE_TYPES.includes(type)) return null;
    if (Number(res.headers.get("content-length") || 0) > MAX_IMAGE_BYTES) return null;
    // Read in pieces and stop as soon as it's too big.
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    if (total < MIN_IMAGE_BYTES) return null;
    return { type, buf: Buffer.concat(chunks) };
  }
  return null; // too many redirects
}

async function linkedImageBlocks(html) {
  const urls = findLinkedImageUrls(html);
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const img = await downloadImage(url);
        if (!img) return null;
        return { type: "image", source: { type: "base64", media_type: img.type, data: img.buf.toString("base64") } };
      } catch {
        return null; // slow, broken, or blocked image links shouldn't block the email
      }
    })
  );
  return results.filter(Boolean);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORIZON_DAYS = Number(process.env.EVENT_HORIZON_DAYS) || 60;
const HEADS_UP_DAYS = 7;

// --- Week-ahead heads-ups for days off ------------------------------------
// Parents often need to line up childcare, so for no-school days and early
// releases we add a "Coming up" reminder a week ahead (on top of the usual
// night-before reminder). Back-to-back days off become one heads-up.
const NO_SCHOOL_RE =
  /\bno school\b|\bschool closed\b|(winter|spring|fall|thanksgiving|holiday|mid-?winter) break|teacher work ?day|\bflex day\b|professional (learning|development)\b|\bPL day\b/i;
const EARLY_RELEASE_RE = /early (release|dismissal)|half[- ]day/i;

const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function dayOffKind(e) {
  if (/^coming up/i.test(e.title)) return null;
  const text = `${e.title} ${e.action || ""}`;
  if (EARLY_RELEASE_RE.test(text)) return "early";
  if (NO_SCHOOL_RE.test(text)) return "off";
  return null;
}

// Short reason for a day off: "No school: PL Flex Day" -> "PL Flex Day",
// "Winter Break begins" -> "Winter Break".
function reasonFor(e) {
  const r = e.title
    .replace(/^no school\s*[:\-–]?\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(begins|starts)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return r && !/^no school$/i.test(r) ? r : "";
}

// Last day of a multi-day break: from the AI's end_date, or written like
// "(11/24-11/27)" or "No school 12/21-1/1" in the title or note.
function endDateOf(e) {
  if (DATE_RE.test(e.end_date || "") && e.end_date > e.date && daysBetween(e.date, e.end_date) <= 21) {
    return e.end_date;
  }
  const m = `${e.title} ${e.action || ""}`.match(/(\d{1,2})\/(\d{1,2})\s*(?:-|–|—|to|through)\s*(\d{1,2})\/(\d{1,2})/i);
  if (!m) return e.date;
  const [y, startMonth] = e.date.split("-").map(Number);
  const endMonth = Number(m[3]);
  const endYear = endMonth < startMonth ? y + 1 : y; // e.g. 12/21-1/1 crosses New Year
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(Number(m[4])).padStart(2, "0")}`;
  return end > e.date && daysBetween(e.date, end) <= 21 ? end : e.date;
}

export function addDayOffHeadsUps(events, sentAt) {
  const sent = isNaN(new Date(sentAt)) ? new Date() : new Date(sentAt);
  const sentDay = sent.toISOString().slice(0, 10);
  const extra = [];

  for (const kind of ["off", "early"]) {
    const days = events
      .filter((e) => dayOffKind(e) === kind)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group days off that are within 3 days of each other (covers weekends).
    const runs = [];
    for (const e of days) {
      const last = runs.at(-1);
      const lastEnd = last ? last.reduce((max, x) => (endDateOf(x) > max ? endDateOf(x) : max), last[0].date) : null;
      if (kind === "off" && last && daysBetween(lastEnd, e.date) <= 3) last.push(e);
      else runs.push([e]);
    }

    for (const run of runs) {
      const first = run[0].date;
      const end = run.reduce((max, x) => (endDateOf(x) > max ? endDateOf(x) : max), first);
      // A week ahead, or tomorrow if that's already passed. Skip if it would
      // land on (or after) the night-before reminder anyway.
      let when = addDays(first, -HEADS_UP_DAYS);
      if (when <= sentDay) when = addDays(sentDay, 1);
      if (when >= addDays(first, -1)) continue;

      // Name the break if there is one ("Thanksgiving Break"), otherwise a single day's reason.
      const named = run.find((e) => /break/i.test(e.title));
      const reason = named ? reasonFor(named) : run.length === 1 && first === end ? reasonFor(run[0]) : "";
      const label =
        kind === "early"
          ? `Early release ${dayLabel(first)}`
          : first === end
            ? `No school ${dayLabel(first)}${reason ? ` (${reason})` : ""}`
            : `No school ${dayLabel(first)}–${dayLabel(end)}${reason ? ` (${reason})` : ""}`;
      const kids = run.some((e) => !(e.kid_ids || []).length)
        ? []
        : [...new Set(run.flatMap((e) => e.kid_ids))];

      extra.push({
        date: when,
        title: `Coming up: ${label}`,
        action: kind === "early" ? "Plan for early pickup if you need to" : "Line up childcare if you need it",
        applies_to: run[0].applies_to || "Whole school",
        date_unclear: run.some((e) => e.date_unclear),
        kid_ids: kids,
      });
    }
  }
  return [...events, ...extra];
}

// The window of dates worth saving: from the day before the email was sent
// (allowing for time zones) through HORIZON_DAYS later, as YYYY-MM-DD strings.
function dateWindow(sentAt) {
  let sent = new Date(sentAt);
  if (isNaN(sent)) sent = new Date();
  const day = 24 * 60 * 60 * 1000;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  return { from: iso(sent.getTime() - day), to: iso(sent.getTime() + (HORIZON_DAYS + 1) * day) };
}

export async function extractEvents({ subject, from, sentAt, bodyText, htmlBody, attachments, kids = [], existing = [] }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set in Vercel.");

  const attached = attachmentBlocks(attachments);
  const linked = await linkedImageBlocks(htmlBody);
  const blocks = [...attached.blocks, ...linked];
  const skipped = attached.skipped;
  if (linked.length) console.log(`Read ${linked.length} linked image(s) from the email.`);
  const kidLine = kids.length
    ? `The family's children (${kids.length}): ${kids.map((k) => `${k.first_name}${k.grade ? ` (${k.grade})` : ""}${k.school ? ` at ${k.school}` : ""}`).join(", ")}.`
    : "The family's children: not listed.";

  const sentDate = new Date(sentAt);
  const sentWeekday = isNaN(sentDate)
    ? ""
    : ` (${sentDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Chicago" })})`;
  const text = [
    `Email sent: ${sentAt}${sentWeekday}`,
    `From: ${from || "unknown"}`,
    `Subject: ${subject || "(no subject)"}`,
    kidLine,
    existing.length
      ? `Already saved for this family (don't repeat these):\n${existing
          .map((e) => `- ${e.date} ${e.title}${e.kids?.length ? ` (${e.kids.join(", ")})` : ""}`)
          .join("\n")}`
      : "",
    "",
    "Email body:",
    (bodyText || "(empty)").slice(0, 40000),
    blocks.length ? "\nImages and attachments from the email are included above." : "",
  ].join("\n");

  async function callClaude(contentBlocks) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        // Big newsletters with several calendars can produce dozens of events.
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        // Newer models don't allow forcing a specific tool, so we let Claude choose;
        // the instructions tell it to always call save_events.
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: [...contentBlocks, { type: "text", text }] }],
      }),
    });
    if (res.ok) return { data: await res.json() };

    // Turn Claude's error into one readable line for the logs.
    const raw = await res.text();
    let detail = raw;
    try {
      const j = JSON.parse(raw);
      detail = `${j.error?.type || "error"}: ${j.error?.message || raw}`;
    } catch {}
    return { status: res.status, detail };
  }

  let result = await callClaude(blocks);

  // If Claude rejected the request and there were attachments, a bad image or
  // PDF is the usual culprit. Log why, then try again with just the text.
  if (result.status === 400 && blocks.length && /image|document|pdf|media|base64|source/i.test(result.detail)) {
    console.warn(`Claude rejected attachments (${result.detail}). Retrying with text only.`);
    skipped.push(...attachments.map((a) => a.Name).filter((n) => !skipped.includes(n)));
    result = await callClaude([]);
  }

  if (!result.data) {
    throw new Error(`Claude API error ${result.status} - ${result.detail}`);
  }

  const data = result.data;
  const call = (data.content || []).find((c) => c.type === "tool_use" && c.name === "save_events");
  let found = call?.input?.events;

  // Backup: if Claude answered in plain text instead of calling the tool,
  // look for a JSON list of events in its reply.
  if (!Array.isArray(found)) {
    const reply = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const match = reply.match(/\{[\s\S]*"events"[\s\S]*\}|\[[\s\S]*\]/);
    try {
      const parsed = match ? JSON.parse(match[0]) : null;
      found = Array.isArray(parsed) ? parsed : parsed?.events;
    } catch {}
    if (!Array.isArray(found)) {
      const why =
        data.stop_reason === "max_tokens"
          ? "the reply ran out of room (too many events for the size limit)"
          : `stop reason: ${data.stop_reason}, reply parts: ${(data.content || []).map((c) => c.type).join(", ") || "none"}`;
      console.warn(`Claude did not return events in the expected format (${why}):`, reply.slice(0, 500));
      found = [];
    }
  }

  // Turn the kids' first names into their IDs. One child (or none) = whole family.
  const byName = new Map(kids.map((k) => [k.first_name.trim().toLowerCase(), k.id]));
  const { from: windowStart, to: windowEnd } = dateWindow(sentAt);
  const valid = found.filter((e) => e && DATE_RE.test(e.date || "") && (e.title || "").trim());
  const inWindow = valid.filter((e) => e.date >= windowStart && e.date <= windowEnd);
  if (inWindow.length < valid.length) {
    console.log(`Skipped ${valid.length - inWindow.length} event(s) outside ${windowStart} to ${windowEnd}.`);
  }
  const events = inWindow
    .map((e) => ({
      ...e,
      kid_ids:
        kids.length > 1
          ? [...new Set((e.for_kids || []).map((n) => byName.get(String(n).trim().toLowerCase())).filter(Boolean))]
          : [],
    }));

  return { events: addDayOffHeadsUps(events, sentAt), skipped };
}
