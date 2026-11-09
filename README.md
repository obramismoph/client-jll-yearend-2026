# ONE JLL Year-End Party 2026: RSVP site

Client: JLL Philippines (event committee). Event: Friday, December 11, 2026,
5 to 10 PM, Golden Bay Seafood Restaurant, Pasay City. Dress code: creative
pastel outfits. Built 2026-11-09 by the CTO chat from Jay's brief, patterned on
the Lhabab Stupa registration system (`Clients/LhababStupa`).

## What it does

- **RSVP page** (`index.html`): last name, first name, business line (the
  Google Form's dropdown), email, contact number. Saves to Supabase, shows a
  QR ticket (download, print, add to Google Calendar) and emails the QR through
  EmailJS. One RSVP per email: a repeat shows the existing QR instead of a
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
| `supabase/schema.sql` | Table, RLS, grants, the three guest functions, the per-line view |
| `selftest.py` | Checks without a database: `python selftest.py` |
| `private/` | Not in git: committee logins and anything with personal data |

Guests never read the table: they call `rsvp_register`, `rsvp_lookup` and
`rsvp_mark_emailed` (security definer), so the public anon key cannot list
anyone's data. Committee members are Supabase Auth users and read, update and
insert walk-ins under RLS.

## Hosting

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
- EmailJS: the Lhabab Stupa account (lhababstupa@gmail.com, now Jay's; 2,000 sends a
  month), Gmail service `service_et3xjoq`, template `template_qrhq1uj` named "JLL
  Year-End RSVP confirmation". Mail arrives from lhababstupa@gmail.com with the display
  name "ONE JLL Year-End Party 2026" and Reply-To obramismoph@gmail.com. To send from
  an Obra Mismo address, add a Gmail service for obramismoph@gmail.com in EmailJS (one
  Google consent click) and change `EMAILJS_SERVICE_ID`.

## Setup from scratch (if it ever has to be rebuilt)

1. **Supabase**: new project (any org of Jay's, free tier). SQL Editor: paste
   `supabase/schema.sql`, run. Authentication > Sign In / Providers: turn
   **off** "Allow new users to sign up" (committee accounts are added by hand).
   Authentication > Users > Add user: the committee login, with a password,
   **Auto Confirm User** on. Keep the password in `private/logins.txt`.
   Project Settings > API: copy the Project URL and the anon public key into
   `js/config.js`.
2. **EmailJS**: a service connected to the sending Gmail, and a template with
   the parameters below. Public key, service id and template id go in
   `js/config.js`. Free plan is 200 emails a month: fine for a few hundred
   RSVPs over two months, watch the quota on the first day the link goes out.
3. `python selftest.py`, commit, push. Open the live page, register a test
   guest, check the email and scan the QR from the dashboard, then delete the
   test row in Supabase (Table Editor > rsvps).

### EmailJS template

Subject: `You're confirmed: {{event_name}} ({{rsvp_id}})`. To: `{{to_email}}`.
Parameters sent by the page: `to_email`, `to_name`, `first_name`, `rsvp_id`,
`business_line`, `qr_url`, `event_name`, `event_date`, `event_time`,
`event_venue`, `event_dress`, `site_url`.

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff8fc;padding:24px;border-radius:16px;color:#3b2a4f">
  <h2 style="color:#562a8c;margin:0 0 6px">Hi {{first_name}}, you're on the list!</h2>
  <p style="margin:0 0 16px">Your RSVP for the <b>{{event_name}}</b> is confirmed.</p>
  <table style="font-size:15px;line-height:1.6">
    <tr><td style="color:#7d6a94;padding-right:12px">When</td><td><b>{{event_date}}</b><br>{{event_time}}</td></tr>
    <tr><td style="color:#7d6a94;padding-right:12px">Where</td><td>{{event_venue}}</td></tr>
    <tr><td style="color:#7d6a94;padding-right:12px">Dress code</td><td>{{event_dress}}</td></tr>
    <tr><td style="color:#7d6a94;padding-right:12px">Business line</td><td>{{business_line}}</td></tr>
  </table>
  <div style="text-align:center;margin:22px 0">
    <img src="{{qr_url}}" width="220" height="220" alt="Your QR code" style="background:#fff;padding:10px;border-radius:12px">
    <div style="font-family:monospace;font-size:20px;letter-spacing:3px;margin-top:8px"><b>{{rsvp_id}}</b></div>
    <p style="color:#7d6a94;font-size:13px">Show this QR code at the registration table. Registration starts at 5:00 PM.</p>
  </div>
  <p style="font-size:13px;color:#7d6a94">Lost this email? Open <a href="{{site_url}}">{{site_url}}</a> and use "Find my QR code".</p>
</div>
```

## Working rules

- Read this file, then `git pull`, before editing. Keep `js/config.js` the only
  place with keys; only public keys, ever.
- `python selftest.py` passes before every commit; add a check with every
  feature.
- Guest data (CSV exports, logins) stays in `private/` or outside the repo.
- Nothing is sent to the client without Jay's yes (root `CLAUDE.md`).
