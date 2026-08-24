/* FilmMatch — matching engine.
   Pure scoring, no network, no LLM. Every result can explain why it ranked. */

const GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-fi",
  53: "Thriller", 10752: "War", 37: "Western"
};

/* Mood weights per genre. Overlaps are intentional — this scores, it doesn't filter. */
const MOOD = {
  laugh:     { 35: 3, 16: 1, 10751: 1, 12: 1 },
  /* Horror leads, but thriller and mystery carry the bucket for the age groups
     and rooms where horror is blocked outright. */
  scared:    { 27: 3, 53: 2, 9648: 1, 878: 1 },
  romantic:  { 10749: 3, 18: 1, 35: 1, 10402: 1, 14: 1 },
  light:     { 35: 2, 10751: 2, 16: 2, 12: 1, 10402: 1, 10749: 1 },
  thinking:  { 878: 2, 18: 2, 9648: 2, 99: 2, 36: 1 }
};

const MOOD_LABEL = {
  laugh: "make you laugh", scared: "scare you", romantic: "something romantic",
  light: "nothing heavy", thinking: "make you think"
};

/* Who you're with. Positive = fits, negative = wrong room. */
const COMPANION = {
  alone:   { 18: 1, 99: 1, 878: 1 },
  partner: { 10749: 2, 18: 1, 35: 1, 10752: -2, 27: -1 },
  friends: { 35: 2, 27: 2, 28: 1, 53: 1, 99: -2, 18: -1 },
  family:  { 10751: 3, 16: 2, 12: 1, 27: -4, 80: -2 }
};

const COMPANION_LABEL = {
  alone: "on your own", partner: "with your partner",
  friends: "with friends", family: "with family"
};

const TIME_LABEL = { short: "under 90 min", medium: "90–120 min", any: "any length" };

const AGE_LABEL = { kid: "under 13", teen: "13–17", adult: "18 or over" };

const ADULT_CERTS = ["R", "NC-17", "18", "TV-MA"];

/* Certification as a number so we can compare it against an age ceiling.
   An unrated film is treated as adult — unknown is not the same as safe. */
const CERT_RANK = {
  "G": 0, "TV-G": 0, "TV-Y": 0, "TV-Y7": 0,
  "PG": 1, "TV-PG": 1,
  "PG-13": 2, "TV-14": 2,
  "R": 3, "TV-MA": 3, "18": 3,
  "NC-17": 4
};
const certRank = film => CERT_RANK[film.cert] !== undefined ? CERT_RANK[film.cert] : 3;

/* The highest certification each age group may be shown. */
const AGE_CEILING = { kid: 1, teen: 2, adult: 4 };

/* A PG from 1954 is not a PG from 2024 — Dial M for Murder and Rope are both
   rated PG. For under-13s the certificate alone is not enough: the film also
   has to be the kind of thing made for children. */
const KID_GENRES = [10751, 16, 12, 14, 35];

/* How many under-seen films may appear in one set of four. The gem pass makes
   obscure films plentiful, and without a cap every result is one — which reads
   as evasive rather than curated. */
const MAX_DISCOVERY = 2;

/* TMDB lists genres primary-first, so position carries real signal: a thriller
   with a drama tag is not the same film as a drama with a thriller tag. */
const POSITION = [1.6, 1, 0.6];
const positionWeight = i => POSITION[i] !== undefined ? POSITION[i] : 0.4;

function weighted(film, table) {
  return film.genres.reduce(
    (sum, g, i) => sum + (table[g] || 0) * positionWeight(i), 0
  );
}

function moodScore(film, mood) {
  return weighted(film, MOOD[mood] || {});
}

function companionScore(film, companion) {
  return weighted(film, COMPANION[companion] || {});
}

/* The genre that actually earned the mood score — never just genres[0]. */
function moodGenre(film, mood) {
  const w = MOOD[mood] || {};
  let best = null, bestVal = 0;
  film.genres.forEach((g, i) => {
    const val = (w[g] || 0) * positionWeight(i);
    if (val > bestVal) { bestVal = val; best = g; }
  });
  return best ? GENRES[best] : null;
}

function runtimeScore(film, time) {
  if (time === "short") return film.runtime <= 90 ? 3 : film.runtime <= 100 ? 1 : -2;
  if (time === "medium") return film.runtime <= 120 ? 2 : film.runtime <= 135 ? 0 : -3;
  return film.runtime >= 100 ? 1 : 0;
}

/* Good but under-seen. This is Discovery Mode. */
function isDiscovery(film) {
  return film.votes < 4000 && film.rating >= 7;
}

/* Hard rules. Getting these wrong loses trust in a way a bad rank never does. */
function allowed(film, answers) {
  const ceiling = AGE_CEILING[answers.age];
  if (ceiling !== undefined && certRank(film) > ceiling) return false;
  if (answers.age === "kid") {
    if (film.genres.includes(27)) return false;
    if (!film.genres.some(g => KID_GENRES.includes(g))) return false;
  }

  if (answers.companion === "family") {
    if (film.genres.includes(27)) return false;
    if (ADULT_CERTS.includes(film.cert)) return false;
  }
  if (answers.time === "short" && film.runtime > 105) return false;
  if (answers.time === "medium" && film.runtime > 145) return false;
  return true;
}

/* Mood claims are phrased from the MOOD, never from a genre label the film
   happens to carry — otherwise "wreck me" comes back as "the thriller you
   asked for" and the explanation is simply untrue. */
const MOOD_CLAIM = {
  laugh:    g => g === "Comedy" ? "it's a comedy that actually lands" : "it should get a laugh out of you",
  scared:   g => g === "Horror" ? "it's horror, no apologies" : "it's built to unsettle you",
  romantic: g => g === "Romance" ? "it's a proper love story" : "there's real romance in it",
  light:    () => "it's easy watching, nothing demanding",
  thinking: g => g === "Documentary" ? "it's a documentary that stays with you" : "it leaves you something to chew on"
};

/* One honest sentence, assembled only from signals that actually scored.
   `index` rotates which signal leads so four cards don't read identically. */
function explain(film, answers, index) {
  const bits = [];

  if (moodScore(film, answers.mood) >= 3) {
    bits.push(MOOD_CLAIM[answers.mood](moodGenre(film, answers.mood)));
  }
  if (answers.time === "short" && film.runtime <= 90) {
    bits.push(`it's done in ${film.runtime} minutes`);
  } else if (answers.time === "medium" && film.runtime <= 120) {
    bits.push(`${film.runtime} minutes fits the evening you've got`);
  } else if (answers.time === "any" && film.runtime > 130) {
    bits.push(`it takes its ${film.runtime} minutes and uses them`);
  }
  if (answers.companion === "family" && film.genres.includes(10751)) {
    bits.push("nobody has to leave the room");
  } else if (answers.companion === "friends" && (film.genres.includes(35) || film.genres.includes(27))) {
    bits.push("it plays better with other people in the room");
  } else if (answers.companion === "partner" && (film.genres.includes(10749) || film.genres.includes(18))) {
    bits.push("it works for two");
  } else if (answers.companion === "alone" && (film.genres.includes(99) || film.genres.includes(18))) {
    bits.push("it asks for your full attention");
  }
  if (answers.age === "kid" && film.genres.includes(10751)) {
    bits.push("it's made for your age group");
  }
  if (isDiscovery(film)) {
    bits.push("almost nobody has seen it");
  }
  if (!bits.length) {
    bits.push("it's the closest thing we have to what you picked");
  }

  const rotated = bits.slice(index % bits.length).concat(bits.slice(0, index % bits.length));
  const sentence = rotated.slice(0, 2).join(" and ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function scoreFilm(film, answers) {
  return moodScore(film, answers.mood) * 3
    + companionScore(film, answers.companion)
    + runtimeScore(film, answers.time)
    + (film.rating - 6) * 0.5
    + (isDiscovery(film) ? 1 : 0);
}

/* Returns 4 films. Same answers twice should not give an identical list, so we
   shuffle a wider shortlist — it also powers "show four more". */
function match(films, answers, opts) {
  const count = (opts && opts.count) || 4;
  const exclude = (opts && opts.exclude) || [];

  const eligible = films
    .filter(f => allowed(f, answers))
    .filter(f => !exclude.includes(f.title));

  /* A film that barely registers on the chosen mood has no business here —
     but never starve the result set to enforce it. */
  const onMood = eligible.filter(f => moodScore(f, answers.mood) >= 1.5);
  const ranked = (onMood.length >= count ? onMood : eligible)
    .map(f => ({ film: f, score: scoreFilm(f, answers) }))
    .sort((a, b) => b.score - a.score);

  /* The top match is always the top match — only the rest of the shortlist
     gets shuffled, so a repeat run varies without demoting the best answer. */
  const [best, ...others] = ranked;
  if (!best) return [];

  const pool = others.slice(0, Math.max(count * 3, 12));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  /* Fill the set, keeping discovery picks to a minority so each result still
     has films people recognise. Relaxes if the cap can't be met. */
  const chosen = [best];
  let discoveryCount = isDiscovery(best.film) ? 1 : 0;
  const skipped = [];
  for (const entry of pool) {
    if (chosen.length >= count) break;
    if (isDiscovery(entry.film) && discoveryCount >= MAX_DISCOVERY) { skipped.push(entry); continue; }
    if (isDiscovery(entry.film)) discoveryCount++;
    chosen.push(entry);
  }
  while (chosen.length < count && skipped.length) chosen.push(skipped.shift());

  return chosen.slice(0, count).map((entry, i) => ({
    ...entry.film,
    genreNames: entry.film.genres.map(g => GENRES[g]).filter(Boolean),
    discovery: isDiscovery(entry.film),
    onMood: moodScore(entry.film, answers.mood) >= 3,
    why: explain(entry.film, answers, i)
  }));
}

window.FilmMatch = { match, GENRES, MOOD_LABEL, COMPANION_LABEL, TIME_LABEL, AGE_LABEL };
