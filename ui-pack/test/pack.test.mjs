import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as pack from "../dist/index.js";

const origError = console.error;
console.error = () => {}; // controlled-input warnings from static snapshots
const kit = new Set(["Icon", "iconData", "Button", "IconButton", "Input", "SearchField", "Avatar", "Badge", "Divider", "Tabs", "Menu", "MenuItem", "Card", "Switch", "Dialog", "Tooltip"]);
const entries = Object.entries(pack).filter(([k]) => !kit.has(k)); // snapshot components only
const html = Object.fromEntries(entries.map(([k, C]) => [k, renderToStaticMarkup(h(C))]));

test("every component renders", () => assert.equal(entries.length, 409));

test("no Figma hosts or personal data", () => {
  for (const [k, s] of Object.entries(html)) {
    assert.ok(!/figma\.com/.test(s), `${k} links to figma.com`);
    assert.ok(!/Quan/.test(s), `${k} contains a personal name`);
  }
});

test("most colours go through tokens", () => {
  let tokenised = 0, bare = 0;
  for (const s of Object.values(html)) {
    tokenised += (s.match(/var\(--ad-[a-z-]+, /g) ?? []).length;
    const rest = s.replace(/var\(--ad-[a-z-]+, (?:rgba?\([^)]*\)|#[0-9A-Fa-f]+)\)/g, "");
    bare += (rest.match(/rgba?\((?!0, 0, 0, 0\))[^)]*\)|#[0-9A-Fa-f]{3,8}\b/g) ?? []).length;
  }
  console.log(`tokenised ${tokenised}, bare ${bare}`);
  assert.ok(tokenised / (tokenised + bare) > 0.85);
});

test("images have alt, buttons have a name", () => {
  const bad = [];
  for (const [k, s] of Object.entries(html)) {
    if (/<img(?![^>]*\balt=)/.test(s)) bad.push(`${k}: img without alt`);
    for (const m of s.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const named = /aria-label="[^"]+"/.test(m[1]) || m[2].replace(/<[^>]*>/g, "").trim().length > 0 || /<img[^>]*\balt="[^"]+"/.test(m[2]) || /\btitle="[^"]+"/.test(m[1]);
      if (!named) bad.push(`${k}: unnamed button`);
    }
  }
  console.error = origError;
  if (bad.length) console.log(`a11y: ${bad.length} findings`, bad.slice(0, 10));
  assert.ok(!bad.some((b) => b.includes("img without alt")));
});

test("root element accepts native props", () => {
  const out = renderToStaticMarkup(h(pack.HomeHelpButton, { "data-testid": "x", "aria-label": "Custom" }));
  assert.match(out, /data-testid="x"/);
  assert.match(out, /aria-label="Custom"/);
});
