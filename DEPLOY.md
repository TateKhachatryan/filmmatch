# Deploying FilmMatch

The site is static — no server, no database. `public/` is the whole thing.

## Rebuild the deployable folder

    node scripts/build-site.mjs

It copies only what the site needs into `public/`, leaving `scripts/` and
`dist/` off the server. Vercel runs this itself on deploy, so you only need it
by hand to preview the deployable folder locally.

`_headers` is there for Netlify or Cloudflare Pages; Vercel reads `vercel.json`
instead. Both are kept so the folder deploys anywhere.

## Deploy to Vercel

Log the CLI in once (opens a browser to authorize):

    npx vercel login

Then deploy, and repeat this one command for every future update:

    npx vercel deploy --prod --yes

Run it from the repo root, not from `public/`. `vercel.json` tells Vercel to run
`scripts/build-site.mjs` and serve `public/`, so the project takes its name from
this folder and the live URL is `https://filmmatch.vercel.app`. That also means
`public/` never needs committing — Vercel rebuilds it.

If you later connect this repo to Vercel through GitHub, the same config makes
every push deploy itself, with no extra setup.

## Adding a custom domain later

Vercel dashboard → filmmatch → Settings → Domains. Vercel shows the exact A or
CNAME record to add at your registrar and issues the certificate itself. No code
changes needed.

## Before you call it launched

`data/films.js` is 60 hand-written films — good enough to demo, not to launch on.
Run the catalog build first:

    TMDB_KEY=your_key node scripts/build-catalog.mjs

Get a key at themoviedb.org/settings/api. TMDB's terms ask you to credit them as
the data source; a line in the footer covers it.
