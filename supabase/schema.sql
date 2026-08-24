-- FilmMatch — run this once in the Supabase SQL editor.
--
-- One table. Supabase's own auth.users already holds the account (email, name,
-- avatar) that Google gives us, so there is no profile table to keep in sync.

create table if not exists seen_films (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- TMDB id, not the title: titles repeat and can change between refreshes.
  film_id     integer     not null,
  -- Denormalised so the profile page can list films that have since dropped
  -- out of the catalogue. Without these, an old mark would show as a bare id.
  title       text        not null,
  year        integer,
  poster      text,
  marked_at   timestamptz not null default now(),

  primary key (user_id, film_id)
);

-- Fetching one user's marks is the only read this app ever does.
create index if not exists seen_films_user_marked_idx
  on seen_films (user_id, marked_at desc);

-- The browser talks to Postgres directly with a public key, so access control
-- lives here rather than in application code. Without RLS enabled, that public
-- key would expose every row to everyone.
alter table seen_films enable row level security;

drop policy if exists "read own marks" on seen_films;
create policy "read own marks" on seen_films
  for select using (auth.uid() = user_id);

drop policy if exists "add own marks" on seen_films;
create policy "add own marks" on seen_films
  for insert with check (auth.uid() = user_id);

drop policy if exists "remove own marks" on seen_films;
create policy "remove own marks" on seen_films
  for delete using (auth.uid() = user_id);

-- No update policy: a mark is created or removed, never edited.
