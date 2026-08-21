/* Inlines the app into one self-contained page for sharing or publishing.
 *   node scripts/bundle.mjs            -> dist/filmmatch.html
 * The multi-file source in the repo root stays the thing you edit. */

import { readFile, writeFile, mkdir } from "node:fs/promises";

const read = f => readFile(f, "utf8");

const [html, css, films, match, app] = await Promise.all([
  read("index.html"), read("styles.css"),
  read("data/films.js"), read("match.js"), read("app.js")
]);

/* Keep only what's inside <body>, minus the script tags — the artifact host
   supplies the document skeleton. */
const body = html
  .slice(html.indexOf("<main"), html.lastIndexOf("</main>") + 7);

const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
/* The site's <title> carries an SEO tail; a shared page wants just the name. */
const page = `<title>FilmMatch</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
:root { color-scheme: light; }
${css}</style>
${body}
<script>${films}</script>
<script>${match}</script>
<script>${app}</script>
`;

await mkdir("dist", { recursive: true });
await writeFile("dist/filmmatch.html", page);
console.log(`wrote dist/filmmatch.html — ${(page.length / 1024).toFixed(0)} KB`);
