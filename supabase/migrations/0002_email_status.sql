-- 0002: confirmation emails move from EmailJS (browser) to Resend (edge
-- function send-confirmation). Tracks attempts and errors so the hourly
-- catch-up can retry and the dashboard can show "email failed".
-- Run in the SQL Editor after 0001_init.sql. Safe to re-run.

alter table public.rsvps
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_error    text;

-- The browser no longer marks emails; the function does it with the service role.
drop function if exists public.rsvp_mark_emailed(text, text);

-- Hourly catch-up: asks the function to send anything still unsent (Resend's
-- 100-a-day free cap, a bad moment, a webhook miss). The function is safe to
-- call without a key (see its header comment).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('jll-email-catchup') where exists (select 1 from cron.job where jobname = 'jll-email-catchup');
select cron.schedule(
  'jll-email-catchup',
  '17 * * * *',
  $$ select net.http_post(
       url     := 'https://uzioduceglvxbimkgmeu.supabase.co/functions/v1/send-confirmation',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{"mode": "catchup"}'::jsonb
     ); $$
);
