-- 0003: the edge function send-confirmation connects as service_role, and
-- since 2026-10-30 new Supabase tables carry no automatic grants for any
-- role, so it got "permission denied for table rsvps". Grant it explicitly.
-- Safe to re-run.

grant all on table public.rsvps to service_role;
grant select on public.rsvp_by_line to service_role;

-- What the catch-up would pick up right now (rows never emailed).
select id, first_name, last_name, email, email_sent_at, email_attempts, email_error
from public.rsvps where walk_in = false order by created_at;
