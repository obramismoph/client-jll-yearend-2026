-- 0004: only listed admins may delete a guest; every deletion is logged.
-- To let another committee member delete, add their login email to
-- public.rsvp_admins (SQL below). Staff accounts stay without delete.
-- Safe to re-run.

create table if not exists public.rsvp_admins (
  email text primary key check (email = lower(email))
);
alter table public.rsvp_admins enable row level security;
revoke all on table public.rsvp_admins from anon;
grant select on table public.rsvp_admins to authenticated;
grant all on table public.rsvp_admins to service_role;

-- A signed-in user can read only their own row (the dashboard uses it to
-- decide whether to show the Delete button).
drop policy if exists "read own admin row" on public.rsvp_admins;
create policy "read own admin row" on public.rsvp_admins for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

insert into public.rsvp_admins (email) values ('eventmastersxjll@gmail.com') on conflict do nothing;

-- Deleting a guest: admins only (enforced here, not just in the page).
grant delete on table public.rsvps to authenticated;
drop policy if exists "admins delete guests" on public.rsvps;
create policy "admins delete guests" on public.rsvps for delete to authenticated
  using (exists (select 1 from public.rsvp_admins a where a.email = lower(auth.jwt() ->> 'email')));

-- Deletion log: a full copy of every deleted row, so a mistake can be undone
-- (re-insert from the jsonb). Written by a trigger; nobody edits it from the page.
create table if not exists public.rsvp_deletions (
  id          bigserial primary key,
  rsvp_id     text not null,
  row_data    jsonb not null,
  deleted_by  text,
  deleted_at  timestamptz not null default now()
);
alter table public.rsvp_deletions enable row level security;
revoke all on table public.rsvp_deletions from anon, authenticated;
grant all on table public.rsvp_deletions to service_role;
grant usage, select on sequence public.rsvp_deletions_id_seq to service_role;

create or replace function public.log_rsvp_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvp_deletions (rsvp_id, row_data, deleted_by)
  values (old.id, to_jsonb(old), lower(coalesce(auth.jwt() ->> 'email', current_user)));
  return old;
end $$;
drop trigger if exists rsvp_log_deletion on public.rsvps;
create trigger rsvp_log_deletion before delete on public.rsvps
  for each row execute function public.log_rsvp_deletion();

select (select count(*) from public.rsvp_admins) as admins, (select count(*) from public.rsvps) as guests;
