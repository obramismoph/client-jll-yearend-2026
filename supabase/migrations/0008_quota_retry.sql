-- 0008: give back the attempts that Resend's daily quota used up (Nov 11).
-- Rows refused only for the quota went to 5 attempts and the hourly catch-up
-- skipped them for good. The function now ignores quota refusals when
-- counting attempts (deploy it first), so this one reset is all that is needed.
-- Run in the SQL Editor on Jay's yes: the catch-up will then email these guests.
update public.rsvps
   set email_attempts = 0
 where email_sent_at is null
   and walk_in = false
   and email is not null
   and email_error ilike '%quota%';
