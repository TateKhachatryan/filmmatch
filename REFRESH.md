# Refreshing the film catalog

## How often

Monthly. The catalog is 600 films chosen by vote count, and that list barely
moves — a film needs years to gather enough votes to qualify. Refreshing weekly
would spend API calls to change two or three entries, and every refresh
reshuffles what users see, which makes feedback data harder to read.

New releases are the one thing that genuinely dates: a film from this month has
too few votes to qualify for six to twelve months. If newness matters later,
that needs a third pass filtered by release date — a product decision, not a
cadence one.

## By hand

    TMDB_KEY=your_key npm run catalog
    npm test
    npm run deploy

## Automatically

`.github/workflows/refresh-catalog.yml` runs on the 1st of each month, and on
demand from the Actions tab. It fetches, tests, commits only if the catalog
changed, and deploys.

The test step is the important part: it refuses to commit a catalog the matcher
can't work with. That is what would have caught the first fetch, which returned
600 blockbusters and zero Discovery-Mode films.

### Secrets to add

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `TMDB_KEY` | Your TMDB v3 API key |
| `VERCEL_TOKEN` | From vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_wB5LOlMFyS65ohuGG8wu9kxO` |
| `VERCEL_PROJECT_ID` | `prj_XHHeuPoQYYoTf02PTe5GUi2V4pfg` |

If you connect the repo to Vercel instead, the three Vercel secrets are
unnecessary — the workflow's push deploys on its own, and the deploy step skips
itself when `VERCEL_TOKEN` is absent.

## Tuning what gets fetched

`scripts/build-catalog.mjs` reads these from the environment:

| Variable | Default | What it does |
| --- | --- | --- |
| `POPULAR_PAGES` | 15 | Pages of mainstream films, 20 each |
| `GEM_PAGES` | 15 | Pages of under-seen films, 20 each |
| `MIN_VOTES` | 1000 | Quality floor for the mainstream pass |
| `GEM_MIN` | 300 | Quality floor for gems — raise for safer picks |
| `GEM_MAX` | 4000 | Obscurity ceiling; must match `isDiscovery()` in match.js |
| `GEM_RATING` | 7 | Minimum average rating for a gem |

`GEM_MAX` and `isDiscovery()` in `match.js` have to agree. If you change one,
change the other, or films will be fetched as gems but never flagged as
discoveries.
