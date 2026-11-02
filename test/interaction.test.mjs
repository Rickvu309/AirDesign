// Behaviour tests in jsdom: real clicks and keys.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Node", "Event", "KeyboardEvent", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? globalThis[k], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new dom.window.Event("close")); };

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, useState } from "react";
const { render, cleanup, screen, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const k = await import("../dist/index.js");
const origErr = console.error; console.error = () => {};
afterEach(() => cleanup());

test("Tabs: arrow keys move selection and focus, skipping disabled", async () => {
  const user = userEvent.setup();
  const seen = [];
  render(h(k.Tabs, { label: "Mode", onValueChange: (v) => seen.push(v), items: [{ id: "a", label: "A" }, { id: "b", label: "B", disabled: true }, { id: "c", label: "C" }] }));
  screen.getByRole("tab", { name: "A" }).focus();
  await user.keyboard("{ArrowRight}");
  assert.equal(screen.getByRole("tab", { name: "C" }).getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement, screen.getByRole("tab", { name: "C" }));
  await user.keyboard("{Home}");
  assert.deepEqual(seen, ["c", "a"]);
});

test("Switch toggles through onCheckedChange", async () => {
  const user = userEvent.setup();
  function Demo() { const [on, set] = useState(false); return h(k.Switch, { checked: on, onCheckedChange: set, label: "Snap" }); }
  render(h(Demo));
  const sw = screen.getByRole("switch", { name: "Snap" });
  assert.equal(sw.getAttribute("aria-checked"), "false");
  await user.click(sw);
  assert.equal(sw.getAttribute("aria-checked"), "true");
  await user.keyboard(" ");
  assert.equal(sw.getAttribute("aria-checked"), "false");
});

test("Button: loading and disabled do not fire onClick", async () => {
  const user = userEvent.setup();
  let n = 0;
  render(h("div", null, h(k.Button, { onClick: () => n++, loading: true }, "Saving"), h(k.Button, { onClick: () => n++, disabled: true }, "Off"), h(k.Button, { onClick: () => n++ }, "On")));
  await user.click(screen.getByRole("button", { name: "Saving" }));
  await user.click(screen.getByRole("button", { name: "Off" }));
  assert.equal(n, 0);
  await user.click(screen.getByRole("button", { name: "On" }));
  assert.equal(n, 1);
});

test("Checkbox: toggles and shows indeterminate", async () => {
  const user = userEvent.setup();
  render(h("div", null, h(k.Checkbox, { label: "Mixed", indeterminate: true, readOnly: true }), h(k.Checkbox, { label: "Plain" })));
  assert.equal(screen.getByLabelText("Mixed").indeterminate, true);
  const plain = screen.getByLabelText("Plain");
  await user.click(plain);
  assert.equal(plain.checked, true);
});

test("RadioGroup: selecting reports the value, one checked at a time", async () => {
  const user = userEvent.setup();
  const seen = [];
  render(h(k.RadioGroup, { label: "Align", defaultValue: "left", onValueChange: (v) => seen.push(v), options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] }));
  assert.ok(screen.getByRole("group", { name: "Align" }));
  await user.click(screen.getByLabelText("Right"));
  assert.deepEqual(seen, ["right"]);
  assert.equal(screen.getByLabelText("Left").checked, false);
});

test("Slider: reports numbers and sets the fill", () => {
  const seen = [];
  render(h(k.Slider, { label: "Opacity", defaultValue: 20, showValue: true, format: (v) => `${v}%`, onValueChange: (v) => seen.push(v) }));
  const input = screen.getByLabelText("Opacity");
  assert.equal(input.style.getPropertyValue("--ad-slider-fill"), "20%");
  fireEvent.change(input, { target: { value: "75" } });
  assert.deepEqual(seen, [75]);
  assert.equal(screen.getByText("75%").tagName, "OUTPUT");
});

test("Select reports changes", async () => {
  const user = userEvent.setup();
  let got;
  render(h(k.Select, { label: "Font", options: [{ value: "a", label: "Inter" }, { value: "b", label: "Mono" }], onChange: (e) => (got = e.target.value) }));
  await user.selectOptions(screen.getByLabelText("Font"), "b");
  assert.equal(got, "b");
});

test("Toolbar: single tab stop with arrow navigation", async () => {
  const user = userEvent.setup();
  render(h(k.Toolbar, { label: "Tools" }, h(k.IconButton, { icon: "cursor", label: "Move" }), h(k.IconButton, { icon: "hand", label: "Hand" }), h(k.IconButton, { icon: "text", label: "Text" })));
  screen.getByRole("button", { name: "Move" }).focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  assert.equal(document.activeElement, screen.getByRole("button", { name: "Text" }));
  await user.keyboard("{ArrowRight}");
  assert.equal(document.activeElement, screen.getByRole("button", { name: "Move" }));
  await user.keyboard("{End}");
  assert.equal(document.activeElement, screen.getByRole("button", { name: "Text" }));
});

test("ChatComposer: Enter sends, Shift+Enter does not, empty cannot send", async () => {
  const user = userEvent.setup();
  const sent = [];
  function Demo() { const [v, set] = useState(""); return h(k.ChatComposer, { value: v, onValueChange: set, onSend: (t) => { sent.push(t); set(""); } }); }
  render(h(Demo));
  const box = screen.getByLabelText("Message");
  assert.equal(screen.getByRole("button", { name: "Send" }).disabled, true);
  await user.type(box, "hello{Shift>}{Enter}{/Shift}there");
  assert.deepEqual(sent, []);
  await user.keyboard("{Enter}");
  assert.deepEqual(sent, ["hello\nthere"]);
  assert.equal(box.value, "");
});

test("Dialog: opens by prop, Close button reports onClose", async () => {
  const user = userEvent.setup();
  let closed = 0;
  const { rerender } = render(h(k.Dialog, { open: false, onClose: () => closed++, title: "Share" }, "Body"));
  assert.equal(document.querySelector("dialog").hasAttribute("open"), false);
  rerender(h(k.Dialog, { open: true, onClose: () => closed++, title: "Share" }, "Body"));
  assert.equal(document.querySelector("dialog").hasAttribute("open"), true);
  await user.click(screen.getByRole("button", { name: "Close", hidden: true }));
  assert.ok(closed >= 1);
});

test("Input labels are wired and ids are unique", () => {
  render(h("div", null, h(k.Input, { label: "A" }), h(k.Input, { label: "B" }), h(k.Textarea, { label: "C" })));
  const ids = ["A", "B", "C"].map((l) => screen.getByLabelText(l).id);
  assert.equal(new Set(ids).size, 3);
});
console.error = origErr;
