# FilmMatch

Four questions. Four films. One good evening.

A mobile-first film recommender that asks about mood, company, age and time,
then returns four films with a plain-English reason for each — instead of
another endless list to scroll.

Live: https://filmmatch-flax.vercel.app

## How it works

Static HTML, CSS and JavaScript. No server, no database, no framework.

- `index.html` — the whole app: intro, four question screens, results
- `match.js` — the matching engine
- `data/films.js` — the catalogue, generated from TMDB
- `scripts/` — build the catalogue, build the site, run the tests

The matcher is plain scoring, not an LLM call. Genre weights per mood, adjusted
for who you're watching with and how long you've got, with hard filters for age
certification. That means every result can be explained truthfully — the "why
this one" line is assembled from the signals that actually made the film rank,
which is also why it never claims a film is funny when it scored as a thriller.

Two rules are hard filters rather than scores, because being wrong about them
costs trust in a way a mediocre ranking doesn't: certification against the
viewer's age, and no horror or adult certificates for family viewing. For
under-13s the certificate alone isn't enough — a 1954 PG is not a modern PG —
so the film must also be one made for children.

## Working on it

    npm test              # catalogue checks + all 180 answer combinations
    npm run build         # assemble public/
    npm run deploy        # build and push to production

    TMDB_KEY=xxx npm run catalog    # refresh the catalogue

`npm test` is the gate that matters: it runs every combination of answers and
fails on age leaks, empty result sets, or a catalogue with no Discovery-Mode
films. The monthly refresh workflow won't commit a catalogue that doesn't pass.

See `REFRESH.md` for the catalogue refresh, and `DEPLOY.md` for hosting.

## Data

Film data from [TMDB](https://www.themoviedb.org). This product uses the TMDB
API but is not endorsed or certified by TMDB.
