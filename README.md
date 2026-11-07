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

For now, signups appear in Vercel under your project's **Logs** (search "New signup"). That's enough for carrier review. Before real parents join, connect Supabase in `app/api/signup/route.js` so signups and consent records are saved permanently.

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
