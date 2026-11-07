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
