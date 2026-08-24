/* FilmMatch — screen flow and rendering. */

const I = {
  laugh: '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  scared: '<path d="M18 20V10a6 6 0 00-12 0v10l2-2 2 2 2-2 2 2 2-2z"/><path d="M9.5 10h.01M14.5 10h.01"/>',
  romantic: '<path d="M12 20s-7-4.4-7-9.4A4 4 0 0112 8a4 4 0 017 2.6c0 5-7 9.4-7 9.4z"/>',
  light: '<path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18"/>',
  thinking: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.3.3.5.7.5 1.1v0h6v0c0-.4.2-.8.5-1.1A6 6 0 0012 3z"/>',
  alone: '<path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  partner: '<path d="M12 20s-7-4.4-7-9.4A4 4 0 0112 8a4 4 0 017 2.6c0 5-7 9.4-7 9.4z"/>',
  friends: '<path d="M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/><path d="M2 21c0-3.4 3.1-6 7-6s7 2.6 7 6"/><path d="M17 6.5a3 3 0 010 6"/><path d="M18 15c2.4.6 4 2.2 4 4"/>',
  family: '<path d="M4 21v-9l8-6 8 6v9"/><path d="M9 21v-6h6v6"/>'
};

const QUESTIONS = {
  mood: {
    screen: "s-mood", next: "s-companion",
    options: [
      { key: "laugh",    label: "MAKE ME\nLAUGH",   fill: "coral", icon: "laugh" },
      { key: "scared",   label: "MAKE ME\nSCARED",  fill: "ink",   icon: "scared" },
      { key: "romantic", label: "SOMETHING\nROMANTIC", fill: "blue", icon: "romantic" },
      { key: "light",    label: "NOTHING\nHEAVY",    fill: "",      icon: "light" },
      { key: "thinking", label: "MAKE ME THINK",     fill: "",      icon: "thinking", wide: true }
    ]
  },
  companion: {
    screen: "s-companion", next: "s-age",
    options: [
      { key: "alone",   label: "ON MY\nOWN",       fill: "ink",   icon: "alone" },
      { key: "partner", label: "WITH MY\nPARTNER", fill: "coral", icon: "partner" },
      { key: "friends", label: "WITH\nFRIENDS",    fill: "blue",  icon: "friends" },
      { key: "family",  label: "WITH\nFAMILY",     fill: "",      icon: "family" }
    ]
  },
  age: {
    screen: "s-age", next: "s-time",
    options: [
      { key: "kid",   label: "UNDER 13", note: "Nothing above a PG" },
      { key: "teen",  label: "13–17",    note: "Up to a PG-13" },
      { key: "adult", label: "18 OR OVER", note: "Anything goes" }
    ]
  },
  time: {
    screen: "s-time", next: "s-results",
    options: [
      { key: "short",  label: "UNDER 90 MIN", note: "In and out" },
      { key: "medium", label: "90–120 MIN",   note: "A normal evening" },
      { key: "any",    label: "AS LONG AS IT TAKES", note: "Length is not the problem" }
    ]
  }
};

const state = { answers: {}, shown: [], seen: [] };
const $ = sel => document.querySelector(sel);

/* --- build the option UI --- */

function svg(name, cls) {
  return '<svg viewBox="0 0 24 24" class="' + cls + '">' + I[name] + "</svg>";
}

function buildTiles(qKey) {
  const q = QUESTIONS[qKey];
  const host = $("#opts-" + qKey);
  host.innerHTML = "";
  q.options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "tile" + (opt.wide ? " wide" : "");
    if (opt.fill) b.dataset.fill = opt.fill;
    b.innerHTML = svg(opt.icon, "ico") +
      '<span>' + opt.label.replace(/\n/g, "<br>") + "</span>";
    b.addEventListener("click", () => answer(qKey, opt.key));
    host.appendChild(b);
  });
}

function buildRows(qKey) {
  const q = QUESTIONS[qKey];
  const host = $("#opts-" + qKey);
  host.innerHTML = "";
  q.options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "row";
    b.innerHTML = "<span><b>" + opt.label + "</b><br><span>" + opt.note + "</span></span>" +
      '<svg viewBox="0 0 24 24" class="ico"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
    b.addEventListener("click", () => answer(qKey, opt.key));
    host.appendChild(b);
  });
}

/* Analytics without custom events.
   Vercel's script wraps history.pushState, so every pushed path is recorded as
   a page view — and custom events are a Pro feature. Pushing a meaningful path
   turns the Pages panel into an answer breakdown at no cost. replaceState is
   NOT wrapped, so we use it to restore the address bar silently. */
function answersPath(a) {
  return "/r/" + [a.mood, a.companion, a.age, a.time].join("-");
}

function trackPath(path) {
  history.pushState({}, "", path);
}

/* Record a one-off action, then put the address bar back where it was. */
function trackAction(path) {
  const here = location.pathname;
  history.pushState({}, "", path);
  history.replaceState({}, "", here);
}

/* A results URL is shareable: parse it back into answers, or return null. */
function answersFromPath() {
  const m = location.pathname.match(/^\/r\/([a-z]+)-([a-z]+)-([a-z]+)-([a-z]+)/);
  if (!m) return null;
  const [, mood, companion, age, time] = m;
  const valid =
    QUESTIONS.mood.options.some(o => o.key === mood) &&
    QUESTIONS.companion.options.some(o => o.key === companion) &&
    QUESTIONS.age.options.some(o => o.key === age) &&
    QUESTIONS.time.options.some(o => o.key === time);
  return valid ? { mood, companion, age, time } : null;
}

/* --- flow --- */

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("is-on", s.id === id));
  window.scrollTo({ top: 0 });
  const steps = ["s-mood", "s-companion", "s-age", "s-time"];
  const step = steps.indexOf(id);
  const dots = $("#dots");
  dots.innerHTML = "";
  if (step >= 0) {
    for (let i = 0; i < steps.length; i++) {
      const d = document.createElement("i");
      if (i <= step) d.className = "on";
      dots.appendChild(d);
    }
  }
}

function answer(qKey, value) {
  state.answers[qKey] = value;
  const next = QUESTIONS[qKey].next;
  if (next === "s-results") {
    state.seen = [];
    render();
    trackPath(answersPath(state.answers));
  }
  show(next);
}

function reset() {
  state.answers = {};
  state.seen = [];
  trackPath("/");
}

/* --- results --- */

const ART = ["#b52f14", "#1f5fd0", "#17140f", "#d9a34a", "#3f6b58", "#7a2f6b"];

/* TMDB gives us a poster path; the seed catalog has none, so every poster
   falls back to the flat colour block rather than a broken image. */
function artHTML(film, colour, cls) {
  if (!film.poster) return '<div class="' + cls + '" style="background:' + colour + '"></div>';
  return '<img class="' + cls + '" alt="" loading="lazy" style="background:' + colour +
    '" src="https://image.tmdb.org/t/p/w342' + film.poster +
    '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),' +
    '{className:\'' + cls + '\',style:\'background:' + colour + '\'}))">';
}

function watchLink(film) {
  return "https://www.justwatch.com/us/search?q=" + encodeURIComponent(film.title);
}

function metaLine(film) {
  return film.year + " · " + film.genreNames[0] + " · " + film.runtime + " min";
}

function render() {
  const a = state.answers;
  const picks = window.FilmMatch.match(window.FILMS, a, { count: 4, exclude: state.seen });
  state.shown = picks;
  state.seen = state.seen.concat(picks.map(p => p.title));

  const L = window.FilmMatch;
  $("#answer-chips").innerHTML = [
    L.MOOD_LABEL[a.mood], L.COMPANION_LABEL[a.companion],
    L.AGE_LABEL[a.age], L.TIME_LABEL[a.time]
  ].map(t => '<span class="chip">' + t + "</span>").join("");

  if (!picks.length) {
    $("#hero").innerHTML = '<p class="lede">That\'s everything we have for those answers. Try a different mood.</p>';
    $("#rest").innerHTML = "";
    return;
  }

  const offMood = !picks.some(f => f.onMood);
  $("#caveat").innerHTML = offMood
    ? "Nothing that fits <b>" + L.MOOD_LABEL[a.mood] +
      "</b> clears the age rating you picked. These are the closest we can offer."
    : "";
  $("#caveat").hidden = !offMood;

  const top = picks[0];
  $("#hero").innerHTML =
    '<a class="hero" href="' + watchLink(top) + '" target="_blank" rel="noopener">' +
      '<div class="hero-top">' +
        artHTML(top, ART[0], "art") +
        "<div><h2>" + top.title.toUpperCase() + '</h2><div class="meta">' + metaLine(top) +
        '</div><div class="desc">' + top.overview + "</div></div>" +
      "</div>" +
      '<div class="why"><b>Why this one:</b> ' + top.why + "</div>" +
    "</a>";

  $("#rest").innerHTML = picks.slice(1).map((f, i) =>
    '<a class="card" href="' + watchLink(f) + '" target="_blank" rel="noopener">' +
      '<div class="card-row">' +
        artHTML(f, ART[(i + 1) % ART.length], "art") +
        "<div><h3>" + f.title.toUpperCase() + "</h3>" +
        '<div class="meta">' + metaLine(f) + "</div>" +
        '<p class="desc">' + f.overview + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="why"><span class="chip">WHY</span>' + f.why + "</div>" +
      (f.discovery ? '<span class="tag">Lesser known</span>' : "") +
    "</a>"
  ).join("");

  const fb = $("#feedback");
  fb.classList.remove("done");
  fb.querySelector("span").textContent = "Did these fit?";

}

/* Feedback is logged locally for now. Point this at your endpoint when you have one. */
function logVote(vote) {
  const entry = { answers: state.answers, titles: state.shown.map(f => f.title), vote: vote };
  const all = JSON.parse(localStorage.getItem("fm-votes") || "[]");
  all.push(entry);
  localStorage.setItem("fm-votes", JSON.stringify(all));
}

/* --- wiring --- */

buildTiles("mood");
buildTiles("companion");
buildRows("age");
buildRows("time");

document.querySelectorAll("[data-go]").forEach(b =>
  b.addEventListener("click", () => show(b.dataset.go)));

document.querySelectorAll("[data-back]").forEach(b =>
  b.addEventListener("click", () => {
    if (b.dataset.back === "s-intro") reset();
    show(b.dataset.back);
  }));

$("#more").addEventListener("click", () => {
  render();
  trackAction(answersPath(state.answers) + "/more");
});

document.querySelectorAll("[data-vote]").forEach(b =>
  b.addEventListener("click", () => {
    logVote(b.dataset.vote);
    trackAction("/vote/" + b.dataset.vote);
    const fb = $("#feedback");
    fb.classList.add("done");
    fb.querySelector("span").textContent =
      b.dataset.vote === "up" ? "Good — noted." : "Noted. Try four more.";
  }));

/* A shared /r/... link lands straight on its results. */
const shared = answersFromPath();
if (shared) {
  state.answers = shared;
  state.seen = [];
  render();
  show("s-results");
} else {
  show("s-intro");
}
