/* Checks the catalog and the matcher together.
 *   node scripts/test-matching.mjs
 * Exits non-zero on failure so a refresh can never publish a broken catalog. */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
global.window = {};
require("../data/films.js");
require("../match.js");

const FILMS = global.window.FILMS;
const { match } = global.window.FilmMatch;

const MOODS = ["laugh", "scared", "romantic", "light", "thinking"];
const COMPANIONS = ["alone", "partner", "friends", "family"];
const AGES = ["kid", "teen", "adult"];
const TIMES = ["short", "medium", "any"];

const CERT_RANK = { G: 0, "TV-G": 0, PG: 1, "PG-13": 2, R: 3, "NC-17": 4 };
const AGE_CEILING = { kid: 1, teen: 2, adult: 4 };
const KID_GENRES = [10751, 16, 12, 14, 35];
const rank = f => CERT_RANK[f.cert] !== undefined ? CERT_RANK[f.cert] : 3;

const failures = [];
const fail = msg => failures.push(msg);

/* --- the catalog itself --- */

if (FILMS.length < 200) fail(`catalog has only ${FILMS.length} films; expected 200+`);

const broken = FILMS.filter(f =>
  !f.id || !f.title || !f.runtime || f.runtime < 5 || !Array.isArray(f.genres) ||
  !f.genres.length || !f.cert || typeof f.votes !== "number"
);
if (broken.length) fail(`${broken.length} films have missing fields, e.g. ${broken[0].title}`);

const ids = new Set(FILMS.map(f => f.id));
if (ids.size !== FILMS.length) fail(`${FILMS.length - ids.size} duplicate film ids`);

const noPoster = FILMS.filter(f => !f.poster).length;
if (noPoster > FILMS.length * 0.1) fail(`${noPoster} films have no poster (over 10%)`);

const discovery = FILMS.filter(f => f.votes < 4000 && f.rating >= 7).length;
if (discovery < 50) fail(`only ${discovery} Discovery-Mode films; the gem pass likely failed`);

/* --- every answer combination --- */

let combos = 0, empty = 0, thin = 0;

for (const mood of MOODS)
  for (const companion of COMPANIONS)
    for (const age of AGES)
      for (const time of TIMES) {
        combos++;
        const answers = { mood, companion, age, time };
        const label = `${mood}/${companion}/${age}/${time}`;
        const picks = match(FILMS, answers, { count: 4 });

        if (!picks.length) { empty++; fail(`no results at all for ${label}`); continue; }
        if (picks.length < 4) thin++;

        for (const f of picks) {
          if (rank(f) > AGE_CEILING[age]) {
            fail(`age leak: ${label} returned ${f.title} [${f.cert}]`);
          }
          if (age === "kid") {
            if (f.genres.includes(27)) fail(`horror to under-13: ${label} returned ${f.title}`);
            if (!f.genres.some(g => KID_GENRES.includes(g))) {
              fail(`not a children's film: ${label} returned ${f.title}`);
            }
          }
          if (companion === "family" && ["R", "NC-17"].includes(f.cert)) {
            fail(`adult cert for family viewing: ${label} returned ${f.title} [${f.cert}]`);
          }
          if (!f.why || !f.why.endsWith(".")) fail(`malformed reason for ${f.title}: "${f.why}"`);
        }
      }

/* --- report --- */

console.log(`catalog: ${FILMS.length} films, ${discovery} Discovery-Mode candidates`);
console.log(`combinations: ${combos} tested, ${empty} empty, ${thin} returning fewer than 4`);

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
  if (failures.length > 20) console.error(`  ...and ${failures.length - 20} more`);
  process.exit(1);
}

console.log("\nall checks passed");
