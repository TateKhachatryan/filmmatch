/* Copies just the files the site needs into public/ for deployment.
 *   node scripts/build-site.mjs
 * Keeps scripts/ and dist/ off the server. */

import { cp, mkdir, rm } from "node:fs/promises";

const FILES = [
  "index.html", "styles.css", "match.js", "app.js",
  "config.js", "auth.js", "vendor/supabase.js",
  "favicon.svg", "manifest.json", "_headers",
  "data/films.js"
];

await rm("public", { recursive: true, force: true });
await mkdir("public/data", { recursive: true });
await mkdir("public/vendor", { recursive: true });
for (const f of FILES) await cp(f, `public/${f}`);
console.log(`public/ ready — ${FILES.length} files`);
