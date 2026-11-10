# EmailJS setup for EMM (ONE JLL Year-End Party 2026 RSVP)

The RSVP site emails each guest a QR code the moment they register. The email
goes out through EmailJS, a small service that connects to your Gmail. This
guide creates your own EmailJS account so the emails come from your address
and replies land in your inbox. About 10 minutes.

## 1. Create the account

1. Open https://www.emailjs.com and click **Sign Up**.
2. Choose **Continue with Google** and pick the mailbox the emails should come
   from. Free plan is fine to start (200 emails a month; see the note at the end).

## 2. Connect your Gmail (this is the sending address)

1. In the dashboard, left menu, **Email Services**, then **Add New Service**.
2. Pick **Gmail**. Name it "JLL RSVP". Click **Connect Account**, choose the same
   Google account, and click **Allow** when Google asks for "Send email on your
   behalf".
3. Click **Create Service**. Copy the **Service ID** shown on the card (it looks
   like `service_abc1234`).

## 3. Add the confirmation template

1. Left menu, **Email Templates**, then **Create New Template**. Any starter is
   fine; click Create Template.
2. Fill the right-hand fields exactly:
   - **To Email:** `{{to_email}}`
   - **From Name:** `ONE JLL Year-End Party 2026`
   - **Reply To:** your email address (replies from guests come here)
   - **Bcc:** your email address too, if you want a copy of every confirmation.
     Leave empty if not.
3. **Subject:** `You're confirmed: {{event_name}} ({{rsvp_id}})`
4. Click **Edit Content**, choose **Code Editor**, select everything in the box
   (Ctrl+A), delete it, and paste the block below. Click **Apply Changes**.
5. Open the **Settings** tab at the top, name the template "JLL RSVP
   confirmation", copy the **Template ID** (looks like `template_xyz5678`).
6. Click **Save** (top right).

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

## 4. Send these three values to Jay

1. **Public Key:** left menu, **Account**, tab **General**, the "Public Key" box.
2. **Service ID** from step 2.
3. **Template ID** from step 3.

These three are public values (they are visible in the website's code), so a
chat message is fine. Never send your Google password or any "Private Key".

Jay's team puts them into the site and sends one test RSVP so you see the
email arrive from your own address.

## Good to know

- **Quota.** The free plan sends 200 emails a month; the counter is at the top
  of the EmailJS dashboard ("requests left"). Guests past the limit are still
  registered and see their QR on screen, but get no email. Upgrade under
  **Account > Subscriptions** before the count runs out if the guest list is
  large.
- **Gmail's own limit** is about 500 emails a day for a personal Gmail, more
  for Google Workspace.
- Check the first test email's **Spam** folder. If it lands there, mark it
  "Not spam" once; later ones usually go to the inbox.
- The guest list, counts per business line and the door scanner are on the
  committee dashboard: https://www.obramismoph.com/jll_emm2026/admin (login
  from Jay).
