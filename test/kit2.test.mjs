import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as r } from "react-dom/server";
import * as k from "../dist/index.js";

test("stroke icons render with stroke attributes", () => {
  const out = r(h(k.Icon, { name: "check" }));
  assert.match(out, /stroke="currentColor"/);
  assert.match(out, /fill="none"/);
  assert.ok(Object.keys(k.iconData).length >= 55);
});

test("Progress: determinate and indeterminate", () => {
  assert.match(r(h(k.Progress, { label: "Upload", value: 40 })), /role="progressbar"[^>]*aria-valuenow="40"|aria-valuenow="40"[^>]*role="progressbar"/);
  const ind = r(h(k.Progress, { label: "Working" }));
  assert.ok(!/aria-valuenow/.test(ind));
  assert.match(ind, /ad-progress--indeterminate/);
});

test("Alert roles by tone", () => {
  assert.match(r(h(k.Alert, { tone: "info" }, "x")), /role="status"/);
  assert.match(r(h(k.Alert, { tone: "danger", title: "Failed" }, "x")), /role="alert"/);
});

test("Breadcrumbs mark the current page", () => {
  const out = r(h(k.Breadcrumbs, { items: [{ label: "Home", href: "/" }, { label: "Files", href: "/f" }, { label: "Deck" }] }));
  assert.match(out, /aria-label="Breadcrumb"/);
  assert.equal((out.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(out, /<a href="\/">Home<\/a>/);
});

test("Sidebar items mark the active page", () => {
  const out = r(h(k.Sidebar, { label: "Main" }, h(k.SidebarSection, { title: "Files" }, h(k.SidebarItem, { href: "/a", active: true, icon: "file" }, "Drafts"), h(k.SidebarItem, { href: "/b" }, "Trash"))));
  assert.match(out, /<nav[^>]*aria-label="Main"/);
  assert.equal((out.match(/aria-current="page"/g) ?? []).length, 1);
});

test("Accordion uses native details", () => {
  const out = r(h(k.Accordion, null, h(k.AccordionItem, { title: "Fill", defaultOpen: true }, "x"), h(k.AccordionItem, { title: "Stroke" }, "y")));
  assert.equal((out.match(/<details/g) ?? []).length, 2);
  assert.equal((out.match(/<details[^>]*open=""/g) ?? []).length, 1);
});

test("Popover wires the trigger to its panel", () => {
  const out = r(h(k.Popover, { label: "Colours", trigger: h(k.Button, null, "Open") }, "Panel"));
  const id = out.match(/popovertarget="([^"]+)"/i)[1];
  assert.match(out, new RegExp(`id="${id.replace(/[:.]/g, "\\$&")}"[^>]*popover="auto"|popover="auto"[^>]*id="${id.replace(/[:.]/g, "\\$&")}"`));
});

test("PropertySection is a labelled region with rows", () => {
  const out = r(h(k.PropertySection, { title: "Layout" }, h(k.PropertyRow, { label: "Width" }, h(k.NumberField, { label: "Width", prefix: "W" }))));
  assert.match(out, /<section[^>]*aria-labelledby=/);
  assert.match(out, /<h3[^>]*>Layout<\/h3>/);
});

test("ChatMessage, ChatThread and EmptyState", () => {
  assert.match(r(h(k.ChatThread, null)), /role="log"/);
  const m = r(h(k.ChatMessage, { role: "assistant", streaming: true }, "Hi"));
  assert.match(m, /aria-busy="true"/);
  assert.match(m, /aria-label="Assistant"/);
  assert.match(r(h(k.EmptyState, { title: "No files", description: "Create one", action: h(k.Button, null, "New") })), /No files/);
});

test("ColorSwatch exposes name and state", () => {
  const out = r(h(k.ColorSwatch, { color: "#ff5c16", label: "Brand orange", selected: true }));
  assert.match(out, /aria-label="Brand orange"/);
  assert.match(out, /aria-pressed="true"/);
  assert.match(out, /--ad-swatch:#ff5c16/);
});

test("dark theme overrides exist for every neutral token", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  const dark = css.slice(css.indexOf('[data-theme="dark"]'));
  for (const t of ["ink", "ink-strong", "ink-muted", "ink-subtle", "border", "border-strong", "divider", "divider-strong", "surface", "surface-subtle"]) assert.match(dark, new RegExp(`--ad-${t}:`), t);
});
