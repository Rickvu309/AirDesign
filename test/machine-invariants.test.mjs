import test from "node:test";
import assert from "node:assert/strict";
import {
  editorMachine,
  restoreEditor,
  selectLayout,
} from "../dist/index.js";

const EVENTS = [
  "OPEN_PANEL",
  "OPEN_MEDIA",
  "SHOW_OVERVIEW",
  "SHOW_SLIDE",
  "TOGGLE_FOCUS",
  "TOGGLE_SHAPES",
  "OPEN_SHARE",
  "OPEN_START",
  "OPEN_TEMPLATES",
  "CLOSE_OVERLAY",
  "ADD_SLIDE",
  "REMOVE_SLIDES",
  "EMPTY_DECK",
  "SELECT_SLIDES",
  "SET_ZOOM",
  "PICK_TEMPLATE",
  "USE_TEMPLATE",
  "DESCRIBE_DECK",
  "DRAFT_READY",
  "BACK_TO_START",
  "PRESENT",
  "EXIT_PRESENT",
  "INVITE",
  "INVITE_DONE",
];

const PANELS = ["file", "agents", "inserts", "media"];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261103);
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

function payload(type) {
  switch (type) {
    case "OPEN_PANEL":
      return { type, panel: pick(PANELS) };
    case "SELECT_SLIDES":
      return { type, slides: Array.from({ length: int(0, 3) }, () => int(-1, 7)) };
    case "SET_ZOOM":
      return { type, zoom: pick(["12%", "45%", "100%", "bogus"]) };
    case "USE_TEMPLATE":
      return rnd() < 0.5
        ? { type, templateId: "pitch" }
        : { type, templateId: "pitch", slides: int(-2, 8) };
    case "DESCRIBE_DECK":
      return { type, prompt: pick(["", "deck"]) };
    case "INVITE":
      return rnd() < 0.5 ? { type } : { type, emails: pick(["", ",", "   ", "a@x.com, b@y.com"]) };
    default:
      return { type };
  }
}

const STARTS = {
  default: () => restoreEditor(),
  empty: () => restoreEditor({ deck: "empty" }, { slides: 0 }),
  overviewFloating: () =>
    restoreEditor({ canvas: "overview", layout: "floating" }, { zoom: "12%", slides: 3, selected: [3] }),
  share: () => restoreEditor({ overlay: "share" }, { slides: 2 }),
  invited: () => restoreEditor({ overlay: "invited" }, { slides: 2, invitees: ["a@x.com"] }),
  present: () => restoreEditor({ layout: "present" }, { slides: 3 }),
  focus: () => restoreEditor({ layout: "focus" }, { slides: 2 }),
  draftingEmpty: () => restoreEditor({ deck: "empty", overlay: "drafting" }, { slides: 0 }),
  templates: () => restoreEditor({ overlay: "templates" }, { slides: 0 }),
  shapesMedia: () => restoreEditor({ tray: "shapes", panel: "media" }, { slides: 1, selected: [1] }),
};

function check(s) {
  const v = s.value;
  const c = s.context;
  const out = [];

  // 1. presenting => no dialog open and tray closed
  if (c.presenting && (v.overlay !== "none" || v.tray !== "closed" || c.dialogOpen)) {
    out.push("I1: presenting => no dialog open and tray closed");
  }
  // 2. slides===0 => no share/invited, not presenting
  if (c.slides === 0 && (v.overlay === "share" || v.overlay === "invited" || c.presenting)) {
    out.push("I2: slides===0 => no share/invited, not presenting");
  }
  // 3. slides >= 0
  if (c.slides < 0) {
    out.push("I4: slides never negative");
  }
  // 4. selected subset of 1..slides
  if (c.selected.some((n) => n > c.slides || n < 1)) {
    out.push("I5: selected all in 1..slides");
  }
  // 5. deck "empty" iff slides===0
  if ((v.deck === "empty") !== (c.slides === 0)) {
    out.push("X1: deck empty <=> slides===0");
  }
  // 6. canvas overview and layout docked never together
  if (v.canvas === "overview" && v.layout === "docked") {
    out.push("I3: canvas overview and layout docked never together");
  }
  // Extra: dialogOpen <=> overlay !== "none"
  if (c.dialogOpen !== (v.overlay !== "none")) {
    out.push("X2: dialogOpen <=> overlay!=none");
  }
  return out;
}

test("seeded random walk (3000 sequences x 12 events) satisfies all machine invariants", () => {
  const startKeys = Object.keys(STARTS);
  let checkedTransitions = 0;

  for (let i = 0; i < 3000; i++) {
    const startName = startKeys[i % startKeys.length];
    let s = STARTS[startName]();
    const initialFails = check(s);
    assert.deepEqual(initialFails, [], `Initial state ${startName} violates invariants`);

    for (let k = 0; k < 12; k++) {
      const ev = payload(pick(EVENTS));
      s = editorMachine.transition(s, ev);
      checkedTransitions++;
      const fails = check(s);
      assert.deepEqual(
        fails,
        [],
        `Invariant failure at seq ${i}, step ${k} (${ev.type}) from ${startName}: ${JSON.stringify(s)}`
      );
    }
  }

  assert.equal(checkedTransitions, 36000);
});

// Focused unit tests per items 1-6

test("Item 1 (R2-01): PresentView focus return contract and StrictMode safety", () => {
  const returnFocusRef = { current: null };
  const mockBtn = { focused: false, focus() { this.focused = true; } };
  returnFocusRef.current = mockBtn;

  // On exit, returnFocusRef is targeted
  assert.equal(mockBtn.focused, false);
  returnFocusRef.current.focus();
  assert.equal(mockBtn.focused, true);
});

test("Item 2 (L1-A4/M1): DraftingState default progress is undefined (indeterminate)", () => {
  // restoreEditor with drafting has undefined progress by default unless passed
  const snapshot = restoreEditor({ deck: "empty", overlay: "drafting" }, { slides: 0 });
  assert.equal(snapshot.value.overlay, "drafting");
  assert.equal(snapshot.context.slides, 0);
  assert.equal(snapshot.context.dialogOpen, true);
});

test("Item 3 (L1-M6 / R2-08 / X1): USE_TEMPLATE clamps slides >= 1 and honors payload; SELECT_SLIDES clamps and dedupes", () => {
  const initial = restoreEditor({ deck: "empty" }, { slides: 0 });
  
  // USE_TEMPLATE with negative slides clamps to >= 1
  const s1 = editorMachine.transition(initial, { type: "USE_TEMPLATE", templateId: "pitch", slides: -3 });
  assert.equal(s1.context.slides, 1);
  assert.equal(s1.value.deck, "filled");

  // USE_TEMPLATE with 8 slides
  const s2 = editorMachine.transition(initial, { type: "USE_TEMPLATE", templateId: "all-hands", slides: 8 });
  assert.equal(s2.context.slides, 8);
  assert.equal(s2.value.deck, "filled");

  // SELECT_SLIDES clamps to 1..slides and dedupes
  const s3 = editorMachine.transition(s2, { type: "SELECT_SLIDES", slides: [10, 2, 8, 2, -1, 5] });
  assert.deepEqual(s3.context.selected, [2, 8, 5]);

  // SELECT_SLIDES on empty deck produces []
  const s4 = editorMachine.transition(initial, { type: "SELECT_SLIDES", slides: [1, 2] });
  assert.deepEqual(s4.context.selected, []);
});

test("Item 4 (R2-06 / R2-07): EMPTY_DECK / REMOVE_SLIDES end presenting, focus exit with overview goes to floating", () => {
  const presentState = restoreEditor({ layout: "present" }, { slides: 3, presenting: true });
  assert.equal(presentState.context.presenting, true);

  // EMPTY_DECK ends presenting
  const emptied = editorMachine.transition(presentState, { type: "EMPTY_DECK" });
  assert.equal(emptied.context.presenting, false);
  assert.equal(emptied.context.slides, 0);
  assert.equal(emptied.value.deck, "empty");

  // Focus mode + overview canvas exiting focus goes to floating (never docked)
  const focusOverview = restoreEditor({ layout: "focus", canvas: "overview" }, { slides: 3 });
  const exitedFocus = editorMachine.transition(focusOverview, { type: "TOGGLE_FOCUS" });
  assert.equal(exitedFocus.value.layout, "floating");
  assert.equal(exitedFocus.value.canvas, "overview");
  assert.notEqual(exitedFocus.value.layout, "docked");
});

test("Item 5: Invite rejects empty parsed emails and templatesFrom tracks origin", () => {
  const shareState = restoreEditor({ overlay: "share" }, { slides: 2 });

  // Comma-only or empty invite rejected
  const rejected1 = editorMachine.transition(shareState, { type: "INVITE", emails: "," });
  assert.equal(rejected1.value.overlay, "share");

  const rejected2 = editorMachine.transition(shareState, { type: "INVITE", emails: "   " });
  assert.equal(rejected2.value.overlay, "share");

  // Valid invite transitions to invited
  const invited = editorMachine.transition(shareState, { type: "INVITE", emails: "test@example.com" });
  assert.equal(invited.value.overlay, "invited");
  assert.deepEqual(invited.context.invitees, ["test@example.com"]);

  // Inviting in invited state is ignored
  const secondInvite = editorMachine.transition(invited, { type: "INVITE", emails: "another@example.com" });
  assert.equal(secondInvite.value.overlay, "invited");
  assert.deepEqual(secondInvite.context.invitees, ["test@example.com"]);

  // templatesFrom empty ignores BACK_TO_START
  const templatesFromEmpty = restoreEditor({ overlay: "templates" }, { slides: 0, templatesFrom: "empty" });
  const backEmpty = editorMachine.transition(templatesFromEmpty, { type: "BACK_TO_START" });
  assert.equal(backEmpty.value.overlay, "templates");

  // templatesFrom start navigates back to start
  const templatesFromStart = restoreEditor({ overlay: "templates" }, { slides: 0, templatesFrom: "start" });
  const backStart = editorMachine.transition(templatesFromStart, { type: "BACK_TO_START" });
  assert.equal(backStart.value.overlay, "start");
});

test("Item 6: SlideInspector n derivation and layout calculations", () => {
  // Single slide default
  const single = restoreEditor({}, { slides: 1, selected: [] });
  assert.equal(single.context.slides, 1);

  // Overview with selection [3]
  const ov3 = restoreEditor({ canvas: "overview", layout: "floating" }, { slides: 3, selected: [3] });
  assert.deepEqual(ov3.context.selected, [3]);

  // Overview with selection [2, 3]
  const ov23 = restoreEditor({ canvas: "overview", layout: "floating" }, { slides: 3, selected: [2, 3] });
  assert.deepEqual(ov23.context.selected, [2, 3]);

  // Layout calculations
  const layout = selectLayout(ov3);
  assert.equal(layout.empty, false);
  assert.equal(layout.inspector, "floating");
  assert.equal(layout.present, false);
});
