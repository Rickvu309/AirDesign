import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as r } from "react-dom/server";
import * as k from "../dist/index.js";

test("kit exports", () => {
  for (const n of ["Icon", "Button", "IconButton", "Input", "SearchField", "Avatar", "Badge", "Divider", "Tabs", "Menu", "MenuItem", "Card", "Switch", "Dialog", "Tooltip"]) assert.equal(typeof k[n], "function", n);
});

test("every kit icon renders a path and uses currentColor via CSS", () => {
  const names = Object.keys(k.iconData);
  assert.ok(names.length >= 40);
  for (const name of names) assert.match(r(h(k.Icon, { name })), /<svg[^>]*class="ad-icon"[^>]*><path/);
});

test("icons are decorative unless labelled", () => {
  assert.match(r(h(k.Icon, { name: "search" })), /aria-hidden="true"/);
  assert.match(r(h(k.Icon, { name: "search", label: "Search" })), /role="img" aria-label="Search"/);
});

test("Button: variants, loading and disabled", () => {
  assert.match(r(h(k.Button, { variant: "primary" }, "Go")), /ad-btn--primary/);
  const loading = r(h(k.Button, { loading: true }, "Save"));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /ad-spinner/);
  assert.match(r(h(k.Button, { disabled: true }, "x")), /disabled=""/);
  assert.match(r(h(k.Button, null, "x")), /type="button"/);
});

test("IconButton has an accessible name and toggle state", () => {
  const out = r(h(k.IconButton, { icon: "trash", label: "Delete", pressed: true }));
  assert.match(out, /aria-label="Delete"/);
  assert.match(out, /aria-pressed="true"/);
});

test("Input: label wired to field, invalid and hint", () => {
  const out = r(h(k.Input, { label: "Email", invalid: true, hint: "Required", id: "e" }));
  assert.match(out, /<label for="e"/);
  assert.match(out, /id="e"/);
  assert.match(out, /aria-invalid="true"/);
  assert.match(out, /aria-describedby="e-hint"/);
});

test("Avatar: initials fallback with a name", () => {
  const out = r(h(k.Avatar, { name: "Ada Lovelace" }));
  assert.match(out, /aria-label="Ada Lovelace"/);
  assert.match(out, />AL</);
});

test("Tabs: one selected tab, roving tabindex", () => {
  const out = r(h(k.Tabs, { label: "Mode", items: [{ id: "a", label: "A" }, { id: "b", label: "B" }], defaultValue: "b" }));
  assert.match(out, /role="tablist"/);
  assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.equal((out.match(/tabindex="0"/g) ?? []).length, 1);
});

test("Menu items expose roles", () => {
  const out = r(h(k.Menu, null, h(k.MenuItem, null, "Rename"), h(k.MenuItem, { checked: true }, "Snap")));
  assert.match(out, /role="menu"/);
  assert.match(out, /role="menuitem"/);
  assert.match(out, /role="menuitemcheckbox"[^>]*aria-checked="true"/);
});

test("Switch and Dialog", () => {
  assert.match(r(h(k.Switch, { checked: true, onCheckedChange() {}, label: "Snap" })), /role="switch"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="switch"/);
  const d = r(h(k.Dialog, { open: false, onClose() {}, title: "Share" }, "Body"));
  assert.match(d, /<dialog[^>]*aria-labelledby=/);
  assert.match(d, /<h2[^>]*>Share<\/h2>/);
});

test("Tooltip links label to its trigger", () => {
  const out = r(h(k.Tooltip, { label: "Undo" }, h(k.IconButton, { icon: "arrow-up", label: "Undo" })));
  const id = out.match(/aria-describedby="([^"]+)"/)[1];
  assert.match(out, new RegExp(`role="tooltip" id="${id.replace(/[:.]/g, "\\$&")}"`));
});

test("kit.css only uses tokens for colour", () => {
  // eslint-disable-next-line no-undef
  return import("node:fs").then(({ readFileSync }) => {
    const css = readFileSync(new URL("../src/kit/kit.css", import.meta.url), "utf8").replace(/:root \{[\s\S]*?\n\}/, "");
    const bare = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    assert.deepEqual(bare, ["rgba(0, 0, 0, 0.3)"]); // dialog backdrop scrim
  });
});
