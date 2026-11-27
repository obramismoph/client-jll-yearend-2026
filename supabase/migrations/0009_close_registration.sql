-- ONE JLL Year-End Party 2026: registration CLOSED (2026-11-27, at the
-- committee's request, relayed by Jay).
-- New online RSVPs are refused. A guest who already registered still gets their
-- QR back (the duplicate check runs first). Walk-ins from the dashboard are not
-- affected. Run once in the Supabase SQL Editor. Safe to re-run.
--
-- To reopen: change `select false` to `select true` below, run that one function,
-- and set REGISTRATION_OPEN: true in js/config.js.

create or replace function public.rsvp_is_open() returns boolean
language sql stable set search_path = public as $$ select false $$;

create or replace function public.rsvp_register(
  p_id text, p_last text, p_first text, p_line text, p_email text, p_contact text, p_employee text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rsvps;
begin
  p_email := lower(trim(p_email));
  p_last := trim(p_last); p_first := trim(p_first); p_contact := trim(p_contact);
  p_employee := nullif(regexp_replace(trim(coalesce(p_employee, '')), '\s+', ' ', 'g'), '');
  if p_id !~ '^JLL-[0-9]{6}$' then raise exception 'bad id'; end if;
  if coalesce(p_last,'') = '' or coalesce(p_first,'') = '' or coalesce(p_line,'') = '' then raise exception 'missing name or business line'; end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'bad email'; end if;
  if length(regexp_replace(coalesce(p_contact,''), '\D', '', 'g')) < 10 then raise exception 'bad contact number'; end if;
  if length(p_last) > 80 or length(p_first) > 80 or length(p_line) > 80 or length(p_email) > 120 or length(p_contact) > 20 or length(coalesce(p_employee,'')) > 20 then raise exception 'too long'; end if;

  -- A returning guest (same email) gets their QR back before the new rule applies,
  -- so people who registered before 2026-11-11 are never blocked.
  select * into r from public.rsvps where lower(email) = p_email and walk_in = false limit 1;
  if found then
    return jsonb_build_object('duplicate', true, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                              'business_line', r.business_line, 'email', r.email);
  end if;
  if not public.rsvp_is_open() then
    raise exception 'Registration is now closed';
  end if;
  if p_employee is null then
    raise exception 'Please enter your employee number';
  end if;
  insert into public.rsvps (id, last_name, first_name, business_line, email, contact, employee_no)
    values (p_id, p_last, p_first, p_line, p_email, p_contact, p_employee) returning * into r;
  return jsonb_build_object('duplicate', false, 'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name,
                            'business_line', r.business_line, 'email', r.email);
end $$;

revoke all on function public.rsvp_register(text,text,text,text,text,text,text) from public;
grant execute on function public.rsvp_register(text,text,text,text,text,text,text) to anon, authenticated;
