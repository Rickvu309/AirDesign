import test from "node:test";
import assert from "node:assert/strict";
import { createMachine, editorMachine, restoreEditor } from "../dist/index.js";

const send = (m, s, ...events) => events.reduce((x, e) => m.transition(x, e), s);

test("editor machine starts on the file panel, slide canvas", () => {
  const s = editorMachine.initial;
  assert.deepEqual(s.value, { panel: "file", canvas: "slide", layout: "docked", overlay: "none", tray: "closed", deck: "filled" });
  assert.equal(s.context.presenting, false);
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
  let s = restoreEditor({ deck: "empty", overlay: "start" }, { slides: 0 });
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

test("bug path: closing templates while deck is empty goes to none and can reopen start", () => {
  let s = restoreEditor({ deck: "empty", overlay: "start" }, { slides: 0 });
  // Start -> PICK_TEMPLATE -> templates
  s = send(editorMachine, s, { type: "PICK_TEMPLATE" });
  assert.equal(s.value.overlay, "templates");
  assert.equal(s.value.deck, "empty");

  // Close gallery -> overlay: none, deck: empty (stage will show empty CTA)
  s = send(editorMachine, s, { type: "CLOSE_OVERLAY" });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.value.deck, "empty");

  // Clicking CTA opens start dialog again
  s = send(editorMachine, s, { type: "OPEN_START" });
  assert.equal(s.value.overlay, "start");

  // Templates back to start
  s = send(editorMachine, s, { type: "PICK_TEMPLATE" });
  assert.equal(s.value.overlay, "templates");
  s = send(editorMachine, s, { type: "BACK_TO_START" });
  assert.equal(s.value.overlay, "start");

  // Use template fills deck and closes overlay
  s = send(editorMachine, s, { type: "PICK_TEMPLATE" }, { type: "USE_TEMPLATE" });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.value.deck, "filled");
  assert.equal(s.context.slides, 1);
});

test("drafting flow: describe deck carries prompt and draft ready fills deck", () => {
  let s = restoreEditor({ deck: "empty", overlay: "start" }, { slides: 0 });
  s = send(editorMachine, s, { type: "DESCRIBE_DECK", prompt: "Create AI deck" });
  assert.equal(s.value.overlay, "drafting");
  assert.equal(s.context.draftPrompt, "Create AI deck");

  // Cancel back to start
  s = send(editorMachine, s, { type: "BACK_TO_START" });
  assert.equal(s.value.overlay, "start");

  // Drafting -> DRAFT_READY fills deck
  s = send(editorMachine, s, { type: "DESCRIBE_DECK", prompt: "Test prompt" }, { type: "DRAFT_READY" });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.value.deck, "filled");
  assert.equal(s.context.slides, 1);
});

test("bug 1 (EveryDeckCanPresent): focus can present", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "TOGGLE_FOCUS" });
  assert.equal(s.value.layout, "focus");
  assert.equal(editorMachine.can(s, { type: "PRESENT" }), true);
  s = send(editorMachine, s, { type: "PRESENT" });
  assert.equal(s.context.presenting, true);
  assert.equal(s.value.layout, "focus");
  s = send(editorMachine, s, { type: "EXIT_PRESENT" });
  assert.equal(s.context.presenting, false);
  assert.equal(s.value.layout, "focus");
});

test("bug 2 (PresentIsAlone): press play then Share ignored", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "PRESENT" });
  assert.equal(s.context.presenting, true);
  assert.equal(editorMachine.can(s, { type: "OPEN_SHARE" }), false);
  assert.equal(editorMachine.can(s, { type: "OPEN_START" }), false);
  assert.equal(editorMachine.can(s, { type: "OPEN_PANEL", panel: "agents" }), false);
  assert.equal(editorMachine.can(s, { type: "SHOW_OVERVIEW" }), false);

  const ignored = send(editorMachine, s, { type: "OPEN_SHARE" });
  assert.equal(ignored.context.presenting, true);
  assert.equal(ignored.value.overlay, "none");
});

test("bug 3 (ShareNeedsSlides): Share then REMOVE_SLIDES closes the dialog", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "OPEN_SHARE" });
  assert.equal(s.value.overlay, "share");

  s = send(editorMachine, s, { type: "REMOVE_SLIDES" });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.context.slides, 0);
  assert.equal(s.value.deck, "empty");

  // Also test when in invited overlay
  s = send(editorMachine, editorMachine.initial, { type: "OPEN_SHARE" }, { type: "INVITE" });
  assert.equal(s.value.overlay, "invited");
  s = send(editorMachine, s, { type: "REMOVE_SLIDES" });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.context.slides, 0);
  assert.equal(s.value.deck, "empty");
});

test("bug 4 (LayoutMatchesCanvas): overview->play->exit keeps overview+floating", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "SHOW_OVERVIEW" });
  assert.equal(s.value.canvas, "overview");
  assert.equal(s.value.layout, "floating");

  s = send(editorMachine, s, { type: "PRESENT" });
  assert.equal(s.context.presenting, true);
  assert.equal(s.value.canvas, "overview");
  assert.equal(s.value.layout, "floating");

  s = send(editorMachine, s, { type: "EXIT_PRESENT" });
  assert.equal(s.context.presenting, false);
  assert.equal(s.value.canvas, "overview");
  assert.equal(s.value.layout, "floating");
});

test("bug 5 (UseTemplateKeepsWork): add slide in gallery ignored, USE_TEMPLATE appends when slides>1", () => {
  let s = send(editorMachine, editorMachine.initial, { type: "OPEN_START" }, { type: "PICK_TEMPLATE" });
  assert.equal(s.value.overlay, "templates");

  // ADD_SLIDE while gallery is open is ignored
  const beforeAdd = s.context.slides;
  s = send(editorMachine, s, { type: "ADD_SLIDE" });
  assert.equal(s.context.slides, beforeAdd);
  assert.equal(s.value.overlay, "templates");

  // USE_TEMPLATE on 1 slide replaces
  s = send(editorMachine, s, { type: "USE_TEMPLATE", templateId: "pitch", slides: 1 });
  assert.equal(s.value.overlay, "none");
  assert.equal(s.context.slides, 1);

  // When slides > 1, USE_TEMPLATE appends
  s = send(editorMachine, s, { type: "ADD_SLIDE" }); // slides: 2
  assert.equal(s.context.slides, 2);
  s = send(editorMachine, s, { type: "OPEN_START" }, { type: "PICK_TEMPLATE" });
  s = send(editorMachine, s, { type: "USE_TEMPLATE", templateId: "all-hands", slides: 2 });
  assert.equal(s.context.slides, 4); // 2 + 2 = 4
});

test("restoreEditor normalizes empty deck and present mode", () => {
  // Empty deck defaults to slides 0
  const empty = restoreEditor({ deck: "empty" });
  assert.equal(empty.context.slides, 0);

  // Present in layout normalizes to docked + presenting true
  const pres = restoreEditor({ layout: "present" }, { slides: 3 });
  assert.equal(pres.value.layout, "docked");
  assert.equal(pres.context.presenting, true);
});

test("share and invite overlay transitions", () => {
  let s = editorMachine.initial;
  s = send(editorMachine, s, { type: "OPEN_SHARE" });
  assert.equal(s.value.overlay, "share");

  s = send(editorMachine, s, { type: "INVITE", emails: "user@example.com" });
  assert.equal(s.value.overlay, "invited");
  assert.deepEqual(s.context.invitees, ["user@example.com"]);

  s = send(editorMachine, s, { type: "INVITE_DONE" });
  assert.equal(s.value.overlay, "none");
});
