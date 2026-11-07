// Sends a school email (plus any PDF/image attachments) to Claude and gets back
// a clean list of dated events and to-dos.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // skip anything over ~5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const SYSTEM_PROMPT = `You read school communications for busy parents: district emails, teacher newsletters, PTA messages, ParentSquare/Remind posts, and photos of paper flyers.

Pull out every date-specific item a parent needs to know or act on: early release or no-school days, picture day, spirit/dress-up days, field trips, money or forms due, things to bring, events families are invited to, deadlines.

Rules:
- Only include items tied to a specific date (or a date you can work out, like "next Friday"). Skip general news, reminders with no date, and anything purely informational.
- Resolve relative dates ("this Thursday", "next week Monday") using the date the email was sent. Assume the school year that makes sense for that sent date.
- If an item spans several days (e.g. spirit week), create one event per day that has its own instructions, or one event on the first day if every day is the same.
- If a date is genuinely ambiguous, give your best guess and set date_unclear to true.
- Keep titles short (2-6 words) and actions concrete ("Send $5 in an envelope", "Wear a collared shirt"). Leave action empty if there's nothing to do.
- applies_to says who it's for: "Whole school", "3rd grade", "Mrs. Lee's class", a child's name, etc.
- If there is nothing date-specific, return an empty list.

Always respond by calling the save_events tool.`;

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
          },
          required: ["date", "title", "action", "applies_to", "date_unclear"],
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
    if (!a.Content || size > MAX_ATTACHMENT_BYTES) {
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function extractEvents({ subject, from, sentAt, bodyText, attachments, kids = [] }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set in Vercel.");

  const { blocks, skipped } = attachmentBlocks(attachments);
  const kidLine = kids.length
    ? `The parent's children: ${kids.map((k) => `${k.first_name}${k.grade ? ` (${k.grade})` : ""}${k.school ? ` at ${k.school}` : ""}`).join(", ")}.`
    : "";

  const text = [
    `Email sent: ${sentAt}`,
    `From: ${from || "unknown"}`,
    `Subject: ${subject || "(no subject)"}`,
    kidLine,
    "",
    "Email body:",
    (bodyText || "(empty)").slice(0, 40000),
    blocks.length ? "\nAttachments are included above." : "",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "save_events" },
      messages: [{ role: "user", content: [...blocks, { type: "text", text }] }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const call = (data.content || []).find((c) => c.type === "tool_use" && c.name === "save_events");
  const events = (call?.input?.events || []).filter(
    (e) => e && DATE_RE.test(e.date || "") && (e.title || "").trim()
  );

  return { events, skipped };
}
