-- 0005: table assignment. The client sends the seating plan by email, and the
-- committee picks a table (1 to 55) for each guest in the dashboard.
-- Any signed-in committee login may assign (the existing update policy covers
-- it); guests never see the column. To change the number of tables later:
--   alter table public.rsvps drop constraint rsvps_table_no_check;
--   alter table public.rsvps add constraint rsvps_table_no_check check (table_no between 1 and 80);
-- and change TABLES in js/config.js. Safe to re-run.

alter table public.rsvps add column if not exists table_no smallint
  constraint rsvps_table_no_check check (table_no between 1 and 55);

select count(*) as guests, count(table_no) as with_table from public.rsvps;
