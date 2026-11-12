// Turns a family's events for one day into one short, friendly text.
// With more than one child, items are grouped by kid:
//
//   Bellio: Tomorrow (Fri 11/13):
//   Emma:
//   - PE: wear sneakers
//   Jack:
//   - Return library books
//   Both:
//   - Spirit day: class theme + send toiletries
//   Reply STOP to opt out.

import { plainText } from "@/lib/sms";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const STOP_LINE = "Reply STOP to opt out.";

// "2026-11-13" -> "Fri 11/13"
export function dayLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${m}/${d}`;
}

function shorten(text = "", max = 70) {
  const clean = text.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max).replace(/[,;:\s]+$/, "") + "...";
}

// Sorts events into labeled groups: one per child, a combined group for
// shared items, or a single unlabeled group when grouping isn't useful.
export function groupEvents(events, kids = []) {
  if (kids.length < 2) return [{ label: null, events }];

  const everyoneLabel = kids.length === 2 ? "Both" : "Everyone";
  const order = kids.map((k) => k.id);
  const nameOf = new Map(kids.map((k) => [k.id, k.first_name]));
  const groups = new Map();

  for (const e of events) {
    const ids = (e.kid_ids || []).filter((id) => nameOf.has(id));
    let key, label;
    if (!ids.length || ids.length === kids.length) {
      key = "everyone";
      label = everyoneLabel;
    } else {
      const sorted = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      key = sorted.join(",");
      label = sorted.map((id) => nameOf.get(id)).join(" & ");
    }
    if (!groups.has(key)) groups.set(key, { label, events: [], rank: key === "everyone" ? 999 : order.indexOf(ids[0]) + ids.length / 10 });
    groups.get(key).events.push(e);
  }

  const list = [...groups.values()].sort((a, b) => a.rank - b.rank);
  // If everything is shared, labels add nothing.
  if (list.length === 1 && list[0].label === everyoneLabel) return [{ label: null, events: list[0].events }];
  return list.map(({ label, events }) => ({ label, events }));
}

// Simple version used if the AI is unavailable.
export function templateMessage(events, isoDate, kids = [], when = "Tomorrow") {
  const lines = [`Bellio: ${when} (${dayLabel(isoDate)}):`];
  for (const group of groupEvents(events, kids)) {
    if (group.label) lines.push(`${group.label}:`);
    for (const e of group.events) {
      const action = e.action ? `: ${shorten(e.action, 60)}` : "";
      const unclear = e.date_unclear ? " (date unconfirmed)" : "";
      lines.push(`- ${shorten(e.title, 40)}${action}${unclear}`);
    }
  }
  lines.push(STOP_LINE);
  return lines.join("\n");
}

const PROMPT = `You write the reminder text for Bellio, a service that texts parents about upcoming school events.

You'll get the events for one day, already sorted into groups, plus WHEN ("Tomorrow" or "Today"). Write ONE text message in exactly this format:
Bellio: <WHEN> (<DAY>):
<Group label>:
- <item>
- <item>
<Next group label>:
- <item>
${STOP_LINE}

Rules:
- Keep the groups and their order exactly as given. Write each group's label on its own line followed by a colon. If a group has no label, write its bullets with no label line.
- Never move an item into a different group.
- One bullet per thing the parent needs to know or do. Merge items within a group that belong together.
- Within each group, lead with what the parent must DO or SEND (dress-up themes, items to bring, money, forms), then schedule changes, then FYIs.
- Each bullet under about 50 characters. Plain words, no emojis, no links, no email addresses.
- Use only plain keyboard characters: straight quotes and apostrophes ('), a regular hyphen (-) to start each bullet, three dots (...) instead of an ellipsis, no other bullet symbols, no long dashes, and no accented letters.
- Drop fine print (RSVP details meant for others, ticket notes, background explanations).
- Keep any condition at the start of a bullet ("If not turned in yet: physical to nurse") so parents who are already done know it doesn't apply to them.
- If an event is marked date_unclear, add "(date unconfirmed)" to its bullet.
- Never start a bullet with a grade or class label (no "K:", "Kindergarten:", "3rd grade:").
- Output only the message text, nothing else.`;

export async function composeMessage(events, isoDate, kids = [], when = "Tomorrow") {
  const groups = groupEvents(events, kids);
  const fallback = templateMessage(events, isoDate, kids, when);
  const maxLength = groups.length > 1 ? 640 : 480; // grouped texts need a little more room
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const payload = groups.map((g) => ({
      label: g.label,
      events: g.events.map((e) => ({ title: e.title, action: e.action, date_unclear: e.date_unclear })),
    }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: PROMPT,
        messages: [{ role: "user", content: `WHEN: ${when}\nDAY: ${dayLabel(isoDate)}\nGroups:\n${JSON.stringify(payload, null, 2)}` }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const data = await res.json();
    let text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();

    // Make sure the essentials are there; otherwise use the simple version.
    if (!text.startsWith(`Bellio: ${when}`)) throw new Error("unexpected format");
    for (const g of groups) {
      if (g.label && !text.includes(`${g.label}:`) && !text.includes(`${plainText(g.label)}:`)) {
        throw new Error(`missing group "${g.label}"`);
      }
    }
    // Safety net: strip grade labels like "K:" or "3rd grade:" from the start of bullets.
    text = text.replace(
      /^([-•]\s*)(?:pre-?k|tk|k|kinder(?:garten)?|\d+(?:st|nd|rd|th)?(?:\s*grade)?|grade\s*\d+|whole school|all grades)\s*[:\-–]\s*/gim,
      "$1"
    );
    if (!text.includes(STOP_LINE)) text += `\n${STOP_LINE}`;
    if (text.length > maxLength) throw new Error(`too long (${text.length} chars)`);
    return text;
  } catch (err) {
    console.warn("Composing with AI failed, using simple format:", err.message);
    return fallback;
  }
}
