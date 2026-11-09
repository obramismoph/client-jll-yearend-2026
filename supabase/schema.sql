-- ONE JLL Year-End Party 2026: RSVP database.
-- Run once in the Supabase project's SQL Editor. Safe to re-run (idempotent).
--
-- Rules carried over from Lhabab Stupa:
--  * Guests never read the table. They go through the rsvp_* functions
--    (security definer), so the anon key cannot list other people's data.
--  * Signed-in committee members (role authenticated) read, update and
--    insert walk-ins directly, under RLS.
--  * Since 2026-10-30 new Supabase tables get no automatic grants, so every
--    grant is explicit below.

create table if not exists public.rsvps (
  id             text primary key,                 -- JLL-123456 (walk-ins: JLL-W12345)
  last_name      text not null,
  first_name     text not null,
  business_line  text not null,
  email          text,                             -- walk-ins may have none
  contact        text,
  walk_in        boolean not null default false,
  checked_in     boolean not null default false,
  checked_in_at  timestamptz,
  checked_in_by  text,
  email_sent_at  timestamptz,
  created_at     timestamptz not null default now()
);

-- One online RSVP per email address (walk-ins are exempt).
create unique index if not exists rsvps_email_once
  on public.rsvps (lower(email)) where email is not null and walk_in = false;
create index if not exists rsvps_business_line on public.rsvps (business_line);

alter table public.rsvps enable row level security;

revoke all on table public.rsvps from anon;
grant select, insert, update on table public.rsvps to authenticated;

drop policy if exists "committee reads" on public.rsvps;
create policy "committee reads" on public.rsvps for select to authenticated using (true);
drop policy if exists "committee checks in" on public.rsvps;
create policy "committee checks in" on public.rsvps for update to authenticated using (true) with check (true);
drop policy if exists "committee adds walk-ins" on public.rsvps;
create policy "committee adds walk-ins" on public.rsvps for insert to authenticated with check (true);

-- ---------- guest-facing functions ----------

-- Register. Returns the saved row's public fields; if the email is already
-- registered, returns that row with duplicate = true and saves nothing.
create or replace function public.rsvp_register(
  p_id text, p_last text, p_first text, p_line text, p_email text, p_contact text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rsvps;
begin
  p_email := lower(trim(p_email));
  p_last := trim(p_last); p_first := trim(p_first); p_contact := trim(p_contact);
  if p_id !~ '^JLL-[0-9]{6}$' then raise exception 'bad id'; end if;
  if coalesce(p_last,'') = '' or coalesce(p_first,'') = '' or coalesce(p_line,'') = '' then raise exception 'missing name or business line'; end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'bad email'; end if;
  if length(regexp_replace(coalesce(p_contact,''), '\D', '', 'g')) < 10 then raise exception 'bad contact number'; end if;
  if length(p_last) > 80 or length(p_first) > 80 or length(p_line) > 80 or length(p_email) > 120 or length(p_contact) > 20 then raise exception 'too long'; end if;

  select * into r from public.rsvps where lower(email) = p_email and walk_in = false limit 1;
  if found then
    return jsonb_build_object('duplicate', true, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                              'business_line', r.business_line, 'email', r.email);
  end if;
  insert into public.rsvps (id, last_name, first_name, business_line, email, contact)
    values (p_id, p_last, p_first, p_line, p_email, p_contact) returning * into r;
  return jsonb_build_object('duplicate', false, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                            'business_line', r.business_line, 'email', r.email);
end $$;

-- "Find my QR": the row for an email, or null.
create or replace function public.rsvp_lookup(p_email text)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('id', id, 'first_name', first_name, 'last_name', last_name, 'business_line', business_line, 'email', email)
  from public.rsvps where lower(email) = lower(trim(p_email)) and walk_in = false limit 1;
$$;

-- The page records that the confirmation email went out (id and email must match).
create or replace function public.rsvp_mark_emailed(p_id text, p_email text)
returns void
language sql security definer set search_path = public as $$
  update public.rsvps set email_sent_at = now() where id = p_id and lower(email) = lower(trim(p_email));
$$;

revoke all on function public.rsvp_register(text,text,text,text,text,text) from public;
revoke all on function public.rsvp_lookup(text) from public;
revoke all on function public.rsvp_mark_emailed(text,text) from public;
grant execute on function public.rsvp_register(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.rsvp_lookup(text) to anon, authenticated;
grant execute on function public.rsvp_mark_emailed(text,text) to anon, authenticated;

-- ---------- reporting view (dashboard also computes this client-side) ----------
create or replace view public.rsvp_by_line as
  select business_line,
         count(*) filter (where not walk_in)                 as rsvp_count,
         count(*) filter (where not walk_in and checked_in)  as attended_count,
         count(*) filter (where walk_in and checked_in)      as walk_in_count,
         count(*) filter (where checked_in)                  as present_count
  from public.rsvps group by business_line order by business_line;
revoke all on public.rsvp_by_line from anon;
grant select on public.rsvp_by_line to authenticated;
