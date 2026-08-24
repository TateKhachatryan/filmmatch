-- Run this in the Supabase SQL editor after schema.sql.
--
-- A film you have seen and a film you never want offered are both hidden from
-- recommendations, but they are not the same thing — the profile page has to
-- be able to tell you which is which. One column rather than a second table:
-- the rows are identical in every other respect and share the same policies.

alter table seen_films
  add column if not exists kind text not null default 'seen';

-- Guard the values at the database rather than trusting the browser, since the
-- browser is what writes these rows.
alter table seen_films
  drop constraint if exists seen_films_kind_check;

alter table seen_films
  add constraint seen_films_kind_check check (kind in ('seen', 'skipped'));

-- Existing rows were all created by the "Seen" button, so the default is right
-- and no backfill is needed.
