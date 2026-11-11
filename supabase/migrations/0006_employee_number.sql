-- ONE JLL Year-End Party 2026: employee number on the RSVP.
-- Run once in the Supabase SQL Editor. Safe to re-run. Apply this BEFORE the
-- site that sends p_employee goes live (the old page keeps working either way:
-- p_employee is optional).

alter table public.rsvps add column if not exists employee_no text;
alter table public.rsvps drop constraint if exists rsvps_employee_no_len;
alter table public.rsvps add constraint rsvps_employee_no_len check (employee_no is null or length(employee_no) <= 20);

-- Replace rsvp_register with a version that takes the optional employee number.
drop function if exists public.rsvp_register(text,text,text,text,text,text);
create or replace function public.rsvp_register(
  p_id text, p_last text, p_first text, p_line text, p_email text, p_contact text, p_employee text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rsvps;
begin
  p_email := lower(trim(p_email));
  p_last := trim(p_last); p_first := trim(p_first); p_contact := trim(p_contact);
  p_employee := nullif(trim(coalesce(p_employee, '')), '');
  if p_id !~ '^JLL-[0-9]{6}$' then raise exception 'bad id'; end if;
  if coalesce(p_last,'') = '' or coalesce(p_first,'') = '' or coalesce(p_line,'') = '' then raise exception 'missing name or business line'; end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'bad email'; end if;
  if length(regexp_replace(coalesce(p_contact,''), '\D', '', 'g')) < 10 then raise exception 'bad contact number'; end if;
  if length(p_last) > 80 or length(p_first) > 80 or length(p_line) > 80 or length(p_email) > 120 or length(p_contact) > 20 or length(coalesce(p_employee,'')) > 20 then raise exception 'too long'; end if;

  select * into r from public.rsvps where lower(email) = p_email and walk_in = false limit 1;
  if found then
    return jsonb_build_object('duplicate', true, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                              'business_line', r.business_line, 'email', r.email);
  end if;
  insert into public.rsvps (id, last_name, first_name, business_line, email, contact, employee_no)
    values (p_id, p_last, p_first, p_line, p_email, p_contact, p_employee) returning * into r;
  return jsonb_build_object('duplicate', false, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                            'business_line', r.business_line, 'email', r.email);
end $$;

revoke all on function public.rsvp_register(text,text,text,text,text,text,text) from public;
grant execute on function public.rsvp_register(text,text,text,text,text,text,text) to anon, authenticated;
