// Turns what a parent pastes in step 2 of the setup guide into the list of
// senders their email rule should match.
//
//   "mrs.smith@usd229.org"            -> "@usd229.org"   (covers everyone at the school)
//   "usd229.org" or "www.usd229.org"  -> "@usd229.org"
//   "coach.jones@gmail.com"           -> "coach.jones@gmail.com"  (kept whole: "@gmail.com"
//                                         would forward every Gmail a parent gets)
//   "Mrs Smith <mrs.smith@usd229.org>" -> "@usd229.org"   (copied with the name, as many apps do)

// Free email services: never match the whole domain.
const PERSONAL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net", "charter.net",
  "spectrum.net", "earthlink.net", "mail.com", "gmx.com", "zoho.com",
  "heybellio.com", "inbox.heybellio.com",
]);

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const LOCAL_RE = /^[a-z0-9._%+'-]+$/;

// Returns { sender, personal } for one piece of text, or null if it can't be read.
export function readSender(piece) {
  let s = String(piece || "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^mailto:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  s = s.replace(/^["'(]+|["'.)]+$/g, "");

  if (s.includes("@")) {
    const at = s.lastIndexOf("@");
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (!DOMAIN_RE.test(domain)) return null;
    if (domain.endsWith("heybellio.com")) return { error: "bellio" };
    if (PERSONAL.has(domain)) {
      return local && LOCAL_RE.test(local) ? { sender: `${local}@${domain}`, personal: true } : null;
    }
    return { sender: `@${domain}`, personal: false };
  }

  if (!DOMAIN_RE.test(s)) return null;
  if (s.endsWith("heybellio.com")) return { error: "bellio" };
  if (PERSONAL.has(s)) return { error: "personal-domain", domain: s };
  return { sender: `@${s}`, personal: false };
}

// Reads every box (each may hold several addresses separated by commas,
// semicolons, or spaces). Returns the senders plus anything it couldn't use.
export function readSenders(boxes) {
  const senders = [];
  const personal = [];
  const problems = [];
  for (const box of boxes) {
    // Drop display names ("Smith, Jane" <a@b.org> / Mrs Smith <a@b.org>), then
    // split on commas, semicolons, spaces, and new lines.
    const cleaned = String(box || "")
      .replace(/"[^"]*"/g, " ")
      .replace(/[^,;<>]*<([^<>]+)>/g, " $1 ");
    const pieces = cleaned.split(/[,;\s]+/).filter(Boolean);
    for (const piece of pieces) {
      const r = readSender(piece);
      if (!r) problems.push(`We couldn't read "${piece.slice(0, 60)}". Paste an email address like teacher@school.org.`);
      else if (r.error === "bellio") problems.push("That's your Bellio address. Paste an address your school emails come from.");
      else if (r.error === "personal-domain")
        problems.push(`"${r.domain}" would forward all your ${r.domain} email. Paste the full address instead.`);
      else if (!senders.includes(r.sender)) {
        senders.push(r.sender);
        if (r.personal) personal.push(r.sender);
      }
    }
  }
  return { senders, personal, problems: [...new Set(problems)] };
}
