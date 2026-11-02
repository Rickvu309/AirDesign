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
const e = h;
const row = (title, ...kids) => e("section", { style: { gridColumn: "1 / -1" } }, e("h3", null, title), e("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: 8 } }, ...kids));
const kitDemo = renderToStaticMarkup(
  e("div", { style: { display: "contents" } },
    row("Button · variants, sizes, states", ...["primary", "secondary", "ghost", "danger"].map((v) => e(pack.Button, { key: v, variant: v, iconStart: "plus" }, v)), e(pack.Button, { size: "sm" }, "Small"), e(pack.Button, { variant: "primary", loading: true }, "Saving"), e(pack.Button, { disabled: true }, "Disabled"), e(pack.Button, { variant: "primary", disabled: true }, "Disabled")),
    row("IconButton · ghost, pressed, primary", e(pack.IconButton, { icon: "cursor", label: "Move" }), e(pack.IconButton, { icon: "text", label: "Text", pressed: true }), e(pack.IconButton, { icon: "comment", label: "Comment" }), e(pack.IconButton, { icon: "trash", label: "Delete", variant: "danger" }), e(pack.IconButton, { icon: "play", label: "Present", variant: "primary" }), e(pack.IconButton, { icon: "more", label: "More", size: "sm" })),
    row("Input · SearchField", e(pack.SearchField, null), e(pack.Input, { label: "Name", labelHidden: false, placeholder: "Untitled", hint: "Shown in the file list" }), e(pack.Input, { label: "Email", labelHidden: false, invalid: true, defaultValue: "ada@", hint: "Enter a full address" })),
    row("Avatar · Badge · Switch · Divider", e(pack.Avatar, { name: "Ada Lovelace", size: 32 }), e(pack.Avatar, { name: "Grace Hopper" }), e(pack.Badge, null, "Draft"), e(pack.Badge, { tone: "brand" }, "Pro"), e(pack.Badge, { tone: "info" }, "Shared"), e(pack.Switch, { checked: true, onCheckedChange() {}, label: "Snap" }), e(pack.Switch, { checked: false, onCheckedChange() {}, label: "Grid" }), e(pack.Divider, { orientation: "vertical", style: { height: 24 } })),
    row("Tabs · Tooltip · Menu", e(pack.Tabs, { label: "Mode", items: [{ id: "design", label: "Design" }, { id: "animate", label: "Animate" }, { id: "x", label: "Off", disabled: true }], defaultValue: "design" }), e(pack.Menu, null, e(pack.MenuItem, { icon: "file", hint: "⌘N" }, "New file"), e(pack.MenuItem, { icon: "upload" }, "Import"), e(pack.MenuItem, { checked: true }, "Snap to grid"), e(pack.MenuItem, { icon: "trash", disabled: true }, "Delete"))),
    row("Card", e(pack.Card, { title: "Brand deck", meta: "Edited 2 days ago", interactive: true, style: { width: 220 } }), e(pack.Card, { title: "Untitled", meta: "Just now", style: { width: 220 } })),
    row("Icons · " + Object.keys(pack.iconData).length, ...Object.keys(pack.iconData).map((n) => e("span", { key: n, title: n, style: { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, width: 64, fontSize: 9, color: "#777" } }, e(pack.Icon, { name: n, size: 20, style: { color: "#111" } }), n))),
  ),
);
const card = (m) => `<section data-n="${m.name.toLowerCase()}"><h3>${m.name}<small>${m.group} · ${screenOf(m.source)}${origin[m.name] ? ` · was ${origin[m.name]}` : ""}</small></h3><div class="stage">${renderToStaticMarkup(h(pack[m.name]))}</div></section>`;
writeFileSync(join(pk, "catalog.html"), `<!doctype html><meta charset="utf-8"><title>AirDesign UI catalog</title>
<style>${readFileSync(join(pk, "src/tokens.css"), "utf8")}${readFileSync(join(pk, "src/base.css"), "utf8")}${readFileSync(join(pk, "src/kit/kit.css"), "utf8")}
body{font:13px Inter,sans-serif;margin:0;background:#f5f5f5}header{position:sticky;top:0;background:#fff;padding:12px 20px;border-bottom:1px solid #e6e6e6;z-index:9}
input{width:320px;padding:6px 10px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;padding:16px}
section{background:#fff;border:1px solid #e6e6e6;border-radius:8px;padding:10px;overflow:hidden}h3{margin:0 0 8px;font-size:12px}small{display:block;color:#777;font-weight:400}
.stage{max-height:240px;overflow:auto;background:repeating-conic-gradient(#fafafa 0 25%,#fff 0 50%) 0 0/16px 16px;padding:8px}</style>
<header><b>AirDesign UI</b> · ${manifest.length} components <input id=q placeholder="Filter by name"></header><main><h2 style="grid-column:1/-1;margin:0">Kit</h2>${kitDemo}<h2 style="grid-column:1/-1;margin:16px 0 0">Snapshots (generated from Lunagraph)</h2>${manifest.map(card).join("")}</main>
<script>q.oninput=()=>document.querySelectorAll("section").forEach(s=>s.hidden=!s.dataset.n.includes(q.value.toLowerCase()))</script>`);
console.log("docs written");
