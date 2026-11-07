// Turns a parent's events for tomorrow into one short, friendly text.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const STOP_LINE = "Reply STOP to opt out.";
const MAX_LENGTH = 480; // about 3 text segments; most messages land well under this

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
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max).replace(/[,;:\s]+$/, "") + "…";
}

// Simple version used if the AI is unavailable.
export function templateMessage(events, isoDate) {
  const lines = events.map((e) => {
    const action = e.action ? `: ${shorten(e.action, 60)}` : "";
    const unclear = e.date_unclear ? " (date unconfirmed)" : "";
    return `• ${shorten(e.title, 40)}${action}${unclear}`;
  });
  return [`Bellio: Tomorrow (${dayLabel(isoDate)}):`, ...lines, STOP_LINE].join("\n");
}

const PROMPT = `You write the nightly reminder text for Bellio, a service that texts parents about tomorrow's school events.

Write ONE text message using exactly this format:
Bellio: Tomorrow (<DAY>):
• <item>
• <item>
${STOP_LINE}

Rules:
- One bullet per thing the parent needs to know or do. Merge items that belong together.
- Lead with what the parent must DO or SEND (dress-up themes, items to bring, money, forms), then schedule changes, then FYIs.
- Each bullet under about 50 characters. Plain words, no emojis, no links, no email addresses.
- Drop fine print (RSVP details meant for others, ticket notes, background explanations).
- If an event is marked date_unclear, add "(date unconfirmed)" to its bullet.
- Never put grade or class labels at the start of a bullet (no "K:", "Kindergarten:", "3rd grade:"). The parent already knows who it's for.
- Only if the parent has more than one child and an event is for one specific child, start that bullet with the child's first name (e.g. "Emma: wear sneakers for PE").
- Output only the message text, nothing else.`;

export async function composeMessage(events, isoDate, kids = []) {
  const fallback = templateMessage(events, isoDate);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const items = events.map((e) => ({
      title: e.title,
      action: e.action,
      applies_to: e.applies_to,
      date_unclear: e.date_unclear,
    }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content:
              `DAY: ${dayLabel(isoDate)}\n` +
              `Parent's children: ${kids.length ? kids.map((k) => k.first_name).join(", ") : "one child (name not given)"}\n` +
              `Events:\n${JSON.stringify(items, null, 2)}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const data = await res.json();
    let text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();

    // Make sure the essentials are there; otherwise use the simple version.
    if (!text.startsWith("Bellio:")) throw new Error("unexpected format");
    // Safety net: strip grade labels like "K:" or "3rd grade:" from the start of bullets.
    text = text.replace(
      /^(•\s*)(?:pre-?k|tk|k|kinder(?:garten)?|\d+(?:st|nd|rd|th)?(?:\s*grade)?|grade\s*\d+|whole school|all grades)\s*[:\-–]\s*/gim,
      "$1"
    );
    if (!text.includes(STOP_LINE)) text += `\n${STOP_LINE}`;
    if (text.length > MAX_LENGTH) throw new Error(`too long (${text.length} chars)`);
    return text;
  } catch (err) {
    console.warn("Composing with AI failed, using simple format:", err.message);
    return fallback;
  }
}
