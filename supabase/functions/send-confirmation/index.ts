// ONE JLL Year-End Party 2026: confirmation email through Resend.
//
// Called three ways, all POST with JSON:
//   1. Database webhook on INSERT into public.rsvps   -> { type: "INSERT", record: { id } }
//   2. The committee dashboard's "Resend" button       -> { id: "JLL-123456" }
//   3. The hourly catch-up (pg_cron)                   -> { mode: "catchup" }
//
// Deployed with JWT verification OFF on purpose, so the webhook and pg_cron
// can call it without a key. That is safe because the function never trusts
// the request body: it re-reads the row by id with the service role, sends
// only to the email stored in that row, and only while email_sent_at is null
// and fewer than MAX_ATTEMPTS tries were made. The worst a stranger can do
// is make an unsent confirmation go out a little sooner.
//
// Secrets (Edge Functions > Secrets): RESEND_API_KEY (required),
// MAIL_FROM, MAIL_REPLY_TO, MAIL_BCC (optional overrides of the defaults).
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "ONE JLL Year-End Party 2026 <eventsmasters_jll2026@obramismoph.com>";
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO") ?? "eventmastersxjll@gmail.com";
const MAIL_BCC = Deno.env.get("MAIL_BCC") ?? "eventmastersxjll@gmail.com"; // "" turns the copy off
const SITE_URL = "https://www.obramismoph.com/jll_emm2026";
const QR = (id: string) => `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=1&data=${encodeURIComponent(id)}`;
const EVENT = {
  name: "ONE JLL Year-End Party 2026",
  date: "Friday, December 11, 2026",
  time: "5:00 PM to 10:00 PM (Registration starts at 5:00 PM)",
  venue: "Golden Bay Fresh Seafood Restaurant, Pasay City",
  dress: "Celebrate the holiday in your most creative pastel outfits",
};
const MAX_ATTEMPTS = 5;
const CATCHUP_BATCH = 40;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Rsvp = {
  id: string; first_name: string; last_name: string; business_line: string;
  email: string | null; walk_in: boolean; email_sent_at: string | null; email_attempts: number;
};

// The dashboard's "Resend" button calls this from the browser, so answer the
// CORS preflight and send the headers on every response.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY secret is not set" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body handled below */ }

  let ids: string[] = [];
  const record = body.record as { id?: string } | undefined;
  if (record?.id) ids = [record.id];
  else if (typeof body.id === "string") ids = [body.id];
  else if (body.mode === "catchup") {
    const { data, error } = await sb.from("rsvps").select("id")
      .is("email_sent_at", null).eq("walk_in", false).not("email", "is", null)
      .lt("email_attempts", MAX_ATTEMPTS)
      .lt("created_at", new Date(Date.now() - 60_000).toISOString())
      .order("created_at").limit(CATCHUP_BATCH);
    if (error) return json({ error: error.message }, 500);
    ids = (data ?? []).map((r) => r.id);
  } else return json({ error: "send { id } or { mode: 'catchup' }" }, 400);

  // Stop at the first quota refusal: the rest would only be refused too.
  const results = [];
  for (const id of ids) {
    const r = await sendOne(id);
    results.push(r);
    if ("quota" in r && r.quota) break;
  }
  return json({ results });
});

async function sendOne(id: string) {
  const { data: r, error } = await sb.from("rsvps").select("*").eq("id", id).maybeSingle<Rsvp>();
  if (error) return { id, error: error.message };
  if (!r) return { id, skipped: "not found" };
  if (r.walk_in || !r.email) return { id, skipped: "walk-in or no email" };
  if (r.email_sent_at) return { id, skipped: "already sent" };
  if (r.email_attempts >= MAX_ATTEMPTS) return { id, skipped: "too many attempts" };

  const payload: Record<string, unknown> = {
    from: MAIL_FROM,
    to: [r.email],
    reply_to: MAIL_REPLY_TO,
    subject: `You're confirmed: ${EVENT.name} (${r.id})`,
    html: html(r),
    text: text(r),
  };
  if (MAIL_BCC) payload.bcc = [MAIL_BCC];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (res.ok) {
    await sb.from("rsvps").update({ email_sent_at: new Date().toISOString(), email_error: null, email_attempts: r.email_attempts + 1 }).eq("id", id);
    return { id, sent: true, resend_id: out.id };
  }
  const msg = String(out?.message ?? `HTTP ${res.status}`).slice(0, 300);
  // Resend's daily quota (100 a day on the free plan, every Bcc counts as one
  // more) or its rate limit is not the guest's fault: keep the error for the
  // dashboard but do not use up one of the guest's MAX_ATTEMPTS, so the hourly
  // catch-up sends it once the quota resets (00:00 UTC = 8:00 am Manila).
  const quota = res.status === 429 || /quota|rate limit/i.test(msg);
  const attempts = quota ? r.email_attempts : r.email_attempts + 1;
  await sb.from("rsvps").update({ email_attempts: attempts, email_error: msg }).eq("id", id);
  return { id, sent: false, error: msg, quota };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function html(r: Rsvp) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff8fc;padding:24px;border-radius:16px;color:#3b2a4f;font-size:15px;line-height:1.6">
  <p style="margin:0 0 12px;font-size:18px"><b>\u{1F384}\u2728 Thank you for confirming your attendance!</b></p>
  <p style="margin:0 0 14px">Hi ${esc(r.first_name)}, we're excited to celebrate the holiday season with you at the <b>ONE JLL Year-End Party 2026</b>!</p>
  <p style="margin:0 0 4px">\u{1F4C5} December 11, 2026 (Friday)</p>
  <p style="margin:0 0 4px">\u23F0 5:00 PM</p>
  <p style="margin:0 0 14px">\u{1F4CD} Golden Bay Fresh Seafoods Restaurant, Diosdado Macapagal, Pasay City</p>
  <p style="margin:0 0 4px">Get ready for a fun-filled evening of celebration, good food, and great company!</p>
  <p style="margin:0 0 4px">Don't forget to wear your most creative pastel outfit. \u{1F338}\u{1F380}</p>
  <p style="margin:0 0 18px">See you there! \u{1F942}\u2728</p>
  <div style="text-align:center;margin:22px 0;padding:18px;background:#fff;border-radius:14px">
    <p style="margin:0 0 8px;color:#562a8c"><b>Your entrance QR code</b> (${esc(r.business_line)})</p>
    <img src="${QR(r.id)}" width="220" height="220" alt="Your QR code" style="background:#fff;padding:10px;border-radius:12px">
    <div style="font-family:monospace;font-size:20px;letter-spacing:3px;margin-top:8px"><b>${r.id}</b></div>
    <p style="color:#7d6a94;font-size:13px;margin:8px 0 0">Show this QR code at the registration table. Registration starts at 5:00 PM.</p>
  </div>
  <p style="font-size:13px;color:#7d6a94;margin:0">Lost this email? Open <a href="${SITE_URL}">${SITE_URL}</a> and use "Find my QR code".</p>
</div>`;
}

function text(r: Rsvp) {
  return [`Thank you for confirming your attendance!`, ``,
    `Hi ${r.first_name}, we're excited to celebrate the holiday season with you at the ONE JLL Year-End Party 2026!`, ``,
    `December 11, 2026 (Friday)`, `5:00 PM`, `Golden Bay Fresh Seafoods Restaurant, Diosdado Macapagal, Pasay City`, ``,
    `Get ready for a fun-filled evening of celebration, good food, and great company!`,
    `Don't forget to wear your most creative pastel outfit.`, `See you there!`, ``,
    `Your entrance QR code (${r.business_line}): ${QR(r.id)}`, `RSVP code: ${r.id}`, ``,
    `Show the QR code at the registration table. Registration starts at 5:00 PM.`,
    `Lost this email? Open ${SITE_URL} and use "Find my QR code".`].join("\n");
}
