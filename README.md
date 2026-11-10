# ONE JLL Year-End Party 2026: RSVP site

Client: JLL Philippines (event committee). Event: Friday, December 11, 2026,
5 to 10 PM, Golden Bay Fresh Seafood Restaurant, Pasay City. Dress code: creative
pastel outfits. Built 2026-11-09 by the CTO chat from Jay's brief, patterned on
the Lhabab Stupa registration system (`Clients/LhababStupa`).

## What it does

- **RSVP page** (`index.html`): last name, first name, business line (the
  Google Form's dropdown), email, contact number. Saves to Supabase, shows a
  QR ticket (download, print, add to Google Calendar); the database then emails
  the QR through Resend (edge function `send-confirmation`). One RSVP per email: a repeat shows the existing QR instead of a
  second row. "Find my QR code" re-shows a ticket by email.
- **Committee dashboard** (`admin.html`, Supabase Auth sign-in): RSVP count vs
  actual attendance **per business line** (RSVP'd, attended, walk-ins, total
  present, show-up rate), the full guest list with search and manual check-in,
  a phone **QR scanner** for the door, **Add walk-in** for guests without an
  RSVP, CSV export. Refreshes every 30 seconds.

What it does **not** do: SMS confirmations (needs a paid SMS gateway; the
contact number is collected and exported), seating, payments, plus-ones.

## Files

| File | Job |
|---|---|
| `js/config.js` | The only file to edit: Supabase URL and anon key, EmailJS ids, event text, business lines |
| `index.html`, `js/rsvp.js` | Guest RSVP page |
| `admin.html`, `js/admin.js`, `js/scanner.js` | Committee dashboard and scanner |
| `css/style.css` | Pastel look from the client's poster (`assets/poster.jpg`) |
| `supabase/migrations/0001_init.sql` | Table, RLS, grants, the guest functions, the per-line view |
| `supabase/migrations/0002_email_status.sql` | Email attempts and errors, drops the old mark function, hourly catch-up cron |
| `supabase/migrations/0003_service_role_grant.sql` | Grants the table to service_role (the edge function's role; new tables get no automatic grants) |
| `supabase/functions/send-confirmation/index.ts` | Edge function: sends the confirmation through Resend (webhook on insert, dashboard Resend button, hourly catch-up) |
| `selftest.py` | Checks without a database: `python selftest.py` |
| `private/` | Not in git: committee logins and anything with personal data |

Guests never read the table: they call `rsvp_register` and `rsvp_lookup`
(security definer), so the public anon key cannot list
anyone's data. Committee members are Supabase Auth users and read, update and
insert walk-ins under RLS.

## Hosting

**Client link: https://www.obramismoph.com/jll_emm2026** (committee:
`/jll_emm2026/admin`). That path is a proxy rewrite in `Website/next.config.ts`
to GitHub Pages; the pages carry a `<base href>` to GitHub Pages so their assets
load wherever the HTML is served from.

Static files, no build. Published from GitHub Pages
(`obramismoph/client-jll-yearend-2026`, branch `main`) at
https://obramismoph.github.io/client-jll-yearend-2026/ . Pushing `main` is the deploy.
The repo is public because GitHub Pages on a free account needs that; it holds
only the page and public keys, never guest data. Move to Netlify or a custom
domain later if the client wants a shorter link.

## Live setup (done 2026-11-09 by the CTO through Jay's Chrome)

- Supabase project `jll-yearend-2026`, org Obra Mismo (obramismoph account), ref
  `uzioduceglvxbimkgmeu`, Tokyo. Schema applied, sign-ups off, site URL and redirect
  URL set to `admin.html`. First committee login: obramismoph@gmail.com (password in
  `private/logins.txt`). Add the committee's own address in Authentication > Users.
- Email (since 2026-11-10): **Resend**, account created by Jay with
  eventmastersxjll@gmail.com (EMM's mailbox for this event). Sender
  `ONE JLL Year-End Party 2026 <eventsmasters_jll2026@obramismoph.com>` (domain obramismoph.com
  verified in Resend by DNS records at Namecheap), Reply-To and Bcc
  eventmastersxjll@gmail.com. The edge function `send-confirmation` runs on a
  database webhook (insert on `rsvps`), on the dashboard's Resend button, and
  hourly for anything unsent (`pg_cron` job `jll-email-catchup`). Secrets live in
  Supabase > Edge Functions > Secrets: `RESEND_API_KEY`, optional `MAIL_FROM`,
  `MAIL_REPLY_TO`, `MAIL_BCC`. Resend free plan: 3,000 a month, 100 a day; the
  catch-up sends the rest the next day. EmailJS is no longer used.

## Setup from scratch (if it ever has to be rebuilt)

1. **Supabase**: new project (any org of Jay's, free tier). SQL Editor: paste
   `supabase/migrations/0001_init.sql`, run. Authentication > Sign In / Providers: turn
   **off** "Allow new users to sign up" (committee accounts are added by hand).
   Authentication > Users > Add user: the committee login, with a password,
   **Auto Confirm User** on. Keep the password in `private/logins.txt`.
   Project Settings > API: copy the Project URL and the anon public key into
   `js/config.js`.
2. **Resend**: account, Domains > Add Domain `obramismoph.com`, add the DNS
   records it shows at Namecheap, wait for Verified. API Keys > Create (sending
   access, that domain). Supabase > Edge Functions > Secrets: `RESEND_API_KEY`.
   Deploy `supabase/functions/send-confirmation/index.ts` (dashboard editor or
   `supabase functions deploy send-confirmation --no-verify-jwt`), JWT
   verification **off** (the function is safe without it, see its header).
   Database > Webhooks: on `rsvps` INSERT call that function. Run
   `0002_email_status.sql` and `0003_service_role_grant.sql`.
## Working rules

- Read this file, then `git pull`, before editing. Keep `js/config.js` the only
  place with keys; only public keys, ever.
- `python selftest.py` passes before every commit; add a check with every
  feature.
- Guest data (CSV exports, logins) stays in `private/` or outside the repo.
- Nothing is sent to the client without Jay's yes (root `CLAUDE.md`).
