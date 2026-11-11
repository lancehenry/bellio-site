# Bellio — heybellio.com

One-page site for Bellio: landing page, signup form with SMS consent, Privacy Policy, and SMS Terms. Built with Next.js, ready for Vercel.

## 1. Fill in your details

Open `site.config.js` and update:
- `legalName` — your name or business (e.g. "Jane Smith d/b/a Bellio")
- `contactEmail` — an inbox you actually check
- `smsNumber` — add once Twilio gives you a toll-free number

## 2. Put it on GitHub

1. Create a free GitHub account and a new repository called `bellio-site`.
2. On the repo page, choose **uploading an existing file** and drag in everything from this folder (including the `app` folder).
   Note: if your computer hides `.gitignore`, that's fine; it's optional.

## 3. Deploy on Vercel

1. Sign in to vercel.com with GitHub.
2. **Add New → Project**, pick `bellio-site`, and click **Deploy**. Vercel detects Next.js automatically.
3. In the project, go to **Settings → Domains**, add `heybellio.com` and `www.heybellio.com`, and follow the DNS instructions for wherever you bought the domain.

## 4. Seeing signups

Signups are saved in Supabase → Table Editor → `parents`, along with when and how each parent agreed to texts. Forwarded emails land in `emails`, and the dates the AI finds land in `events`.

## Run it locally (optional)

```
npm install
npm run dev
```
Then open http://localhost:3000.

## Files

- `app/page.js` — landing page
- `app/SignupForm.js` — signup form + consent checkbox
- `app/api/signup/route.js` — receives signups
- `app/privacy/page.js` — Privacy Policy
- `app/terms/page.js` — SMS Terms
- `app/globals.css` — styles
- `site.config.js` — your details, used everywhere

The privacy policy and SMS terms are a solid starting draft, not legal advice. Worth a quick review before you charge money.

## Email processing (step 4)

- `app/api/inbound/route.js` — Postmark posts forwarded emails here. It finds the parent by their address (`<inbox_key>@inbox.heybellio.com`), saves the email, asks Claude for dated events, and saves them.
- `lib/extract.js` — the AI instructions and the call to Claude. Tweak `SYSTEM_PROMPT` to change what gets picked up.
- `lib/db.js` — small helper for reading and writing Supabase.
- `.env.example` — the settings Vercel needs (put real values in Vercel, never in GitHub).

Postmark webhook URL: `https://heybellio.com/api/inbound?token=YOUR_INBOUND_WEBHOOK_SECRET`

## Households, co-parents, and kids (upgrade 002)

- A **household** owns the forwarding address, kids, and events. Each parent is a **member** with their own phone, consent, and STOP.
- Co-parents join through the invite link shown after signup (`/join/<code>`), or by texting **INVITE** to the Bellio number.
- Kids are added at signup (first name, optional grade and school). The AI tags each event with the right kid(s); the nightly text groups items by kid when there's more than one.
- `supabase/migration-002-households.sql` upgrades an existing database. `supabase/schema.sql` is the full current setup for a brand-new project.
- Key files: `lib/households.js`, `lib/events.js`, `lib/compose.js`, `app/api/join/route.js`, `app/join/[code]/`.

## Reminder timing

- **Nightly (about 7pm Central):** `app/api/cron/reminders`, tomorrow's items. Preview: `/api/cron/reminders?key=CRON_SECRET&date=YYYY-MM-DD`
- **Morning catch-up (about 6am Central):** `app/api/cron/morning`, today's items that missed last night's text (e.g. Sunday-night newsletters). Preview: `/api/cron/morning?key=CRON_SECRET&date=YYYY-MM-DD`
- **Late arrivals:** `lib/reminders.js`. Emails/photos arriving 8–9:30pm with items for tomorrow, or 6am–2pm with items for today, are texted right away.
- **Week-ahead heads-ups:** no-school days, breaks, and early releases get a "Coming up" reminder a week before (`lib/extract.js`).
- Times shift an hour later during daylight saving time, and Vercel's free plan runs each job sometime within its hour.

## Security and data cleanup (upgrade 004)

- **Bot protection** (`lib/protect.js`, `app/BotCheck.js`): honeypot field, Cloudflare Turnstile, and rate limits (signups/joins per IP, form-triggered texts per phone and per day, invites, photos, emails per family, replies to unknown numbers).
- **Consent log** (`lib/consent.js`): every opt-in/opt-out is kept 4 years in `consent_events`, even after an account is deleted.
- **Daily cleanup**: `bellio_purge()` in the database, run by the morning job. Wipes email contents after a day (7 days max), deletes events 30 days after they pass, text logs after 90 days, canceled families 30 days after canceling.
- Run `supabase/migration-004-security-cleanup.sql` once, after 002 and 003.

## Auto-forward setup guide

- `/setup` (`app/setup/`): step-by-step Gmail, Outlook, iCloud, and manual instructions. Parents enter their school's email domain and pick services (ParentSquare, Smore, and so on), and the page builds the exact Gmail filter text.
- Linked from the signup and join confirmations (with the family's address filled in), the welcome texts, the HELP reply, the Gmail-code text, and the site footer.
