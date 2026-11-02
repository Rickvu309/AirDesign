// Writes ui-pack/COMPONENTS.md and ui-pack/catalog.html (gitignored) from dist + the Lunagraph manifest.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { TOKENS } from "./ui-pack-transforms.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pk = join(root, "ui-pack");
const req = createRequire(join(pk, "package.json"));
const { createElement: h } = req("react");
const { renderToStaticMarkup } = req("react-dom/server");
const pack = await import(join(pk, "dist/index.js"));
const manifest = JSON.parse(readFileSync(join(root, "lunagraph/components/airdesign/manifest.json"), "utf8"));
const renames = JSON.parse(readFileSync(join(root, "lunagraph/components/airdesign/rename-map.json"), "utf8"));
const origin = Object.fromEntries(Object.entries(renames).map(([a, b]) => [b, a]));
const screenOf = (src) => src.replace(/\.jsx$/, "");
const groups = [...new Set(manifest.map((m) => m.group))].sort();

const md = ["# Components", "", `${manifest.length} components. Import from \`@airdesign/ui\`; load \`@airdesign/ui/tokens.css\` (design tokens) and \`@airdesign/ui/base.css\` (minimal reset; skip it if your app already has a Tailwind-style preflight) once.`, "", "## Tokens", "", "| Token | Default | Use |", "|---|---|---|", ...TOKENS.map(([n, v, d]) => `| \`--ad-${n}\` | \`${v}\` | ${d} |`), "| `--ad-icon` | `var(--ad-ink)` | Default icon fill |", ""];
for (const g of groups) {
  const items = manifest.filter((m) => m.group === g);
  md.push(`## ${g} (${items.length})`, "", "| Component | Source screen | Lunagraph id |", "|---|---|---|", ...items.map((m) => `| \`${m.name}\` | ${screenOf(m.source)} | \`${m.sourceElementId}\` |`), "");
}
writeFileSync(join(pk, "COMPONENTS.md"), md.join("\n"));

console.error = () => {};
const card = (m) => `<section data-n="${m.name.toLowerCase()}"><h3>${m.name}<small>${m.group} · ${screenOf(m.source)}${origin[m.name] ? ` · was ${origin[m.name]}` : ""}</small></h3><div class="stage">${renderToStaticMarkup(h(pack[m.name]))}</div></section>`;
writeFileSync(join(pk, "catalog.html"), `<!doctype html><meta charset="utf-8"><title>AirDesign UI catalog</title>
<style>${readFileSync(join(pk, "src/tokens.css"), "utf8")}${readFileSync(join(pk, "src/base.css"), "utf8")}
body{font:13px Inter,sans-serif;margin:0;background:#f5f5f5}header{position:sticky;top:0;background:#fff;padding:12px 20px;border-bottom:1px solid #e6e6e6;z-index:9}
input{width:320px;padding:6px 10px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;padding:16px}
section{background:#fff;border:1px solid #e6e6e6;border-radius:8px;padding:10px;overflow:hidden}h3{margin:0 0 8px;font-size:12px}small{display:block;color:#777;font-weight:400}
.stage{max-height:240px;overflow:auto;background:repeating-conic-gradient(#fafafa 0 25%,#fff 0 50%) 0 0/16px 16px;padding:8px}</style>
<header><b>AirDesign UI</b> · ${manifest.length} components <input id=q placeholder="Filter by name"></header><main>${manifest.map(card).join("")}</main>
<script>q.oninput=()=>document.querySelectorAll("section").forEach(s=>s.hidden=!s.dataset.n.includes(q.value.toLowerCase()))</script>`);
console.log("docs written");
