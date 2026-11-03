import test from "node:test";
import assert from "node:assert/strict";
import { createMachine, editorMachine } from "../dist/index.js";

const send = (m, s, ...events) => events.reduce((x, e) => m.transition(x, e), s);

test("editor machine starts on the file panel, slide canvas", () => {
  const s = editorMachine.initial;
  assert.deepEqual(s.value, { panel: "file", canvas: "slide", layout: "docked", overlay: "none", tray: "closed", deck: "filled" });
});

test("one event moves several regions together", () => {
  const s = send(editorMachine, editorMachine.initial, { type: "SHOW_OVERVIEW" });
  assert.equal(s.value.canvas, "overview");
  assert.equal(s.value.layout, "floating");
  assert.equal(s.context.zoom, "12%");
  const back = send(editorMachine, s, { type: "SHOW_SLIDE" });
  assert.equal(back.value.layout, "docked");
  assert.equal(back.context.zoom, "45%");
});

test("panels switch by event, media only opens from inserts", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "OPEN_MEDIA" });
  assert.equal(s.value.panel, "file");
  s = send(editorMachine, s, { type: "OPEN_PANEL", panel: "inserts" }, { type: "OPEN_MEDIA" });
  assert.equal(s.value.panel, "media");
});

test("shapes tray closes when another panel opens", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "TOGGLE_SHAPES" });
  assert.equal(s.value.tray, "shapes");
  s = send(editorMachine, s, { type: "OPEN_PANEL", panel: "agents" });
  assert.equal(s.value.tray, "closed");
});

test("overlays open and close", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "OPEN_SHARE" });
  assert.equal(s.value.overlay, "share");
  assert.equal(editorMachine.can(s, { type: "OPEN_START" }), false);
  s = send(editorMachine, s, { type: "CLOSE_OVERLAY" });
  assert.equal(s.value.overlay, "none");
});

test("empty deck fills on ADD_SLIDE and closes the start dialog", () => {
  let s = editorMachine.restore({ deck: "empty", overlay: "start" }, { slides: 0 });
  s = send(editorMachine, s, { type: "SELECT_SLIDES", slides: [1] });
  assert.deepEqual(s.context.selected, []);
  s = send(editorMachine, s, { type: "ADD_SLIDE" });
  assert.equal(s.value.deck, "filled");
  assert.equal(s.value.overlay, "none");
  assert.equal(s.context.slides, 1);
  s = send(editorMachine, s, { type: "ADD_SLIDE" });
  assert.equal(s.context.slides, 2);
});

test("unhandled events return the same snapshot", () => {
  const s = editorMachine.initial;
  assert.equal(editorMachine.transition(s, { type: "CLOSE_OVERLAY" }), s);
});

test("restore validates names and createMachine validates targets", () => {
  assert.throws(() => editorMachine.restore({ panel: "nope" }));
  assert.throws(() => createMachine({ id: "x", context: {}, regions: { r: { initial: "a", states: { a: { on: { GO: "b" } } } } } }));
});
