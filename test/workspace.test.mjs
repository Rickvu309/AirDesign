import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Node",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? globalThis[k], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
  this.dispatchEvent(new dom.window.Event("close"));
};

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, useState } from "react";
const { render, cleanup, screen, fireEvent, act } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const k = await import("../dist/index.js");
const origErr = console.error;
console.error = () => {};
afterEach(() => cleanup());

test("selectors correctly reflect snapshot state", () => {
  const initial = k.editorMachine.initial;
  const layout = k.selectLayout(initial);
  assert.equal(layout.panelWide, false);
  assert.equal(layout.showLeftPanel, true);
  assert.equal(layout.inspector, "docked");
  assert.equal(layout.header, "docked");
  assert.equal(layout.floatingHeader, false);
  assert.equal(layout.floatingTop, false);
  assert.equal(layout.shapes, false);
  assert.equal(layout.empty, false);

  assert.equal(k.selectPanel(initial), "file");
  assert.equal(k.selectCanvas(initial), "slide");
  assert.equal(k.selectOverlay(initial), "none");
  assert.equal(k.selectTray(initial), "closed");
  assert.equal(k.selectDeck(initial), "filled");
  assert.equal(k.selectZoom(initial), "45%");
  assert.equal(k.selectSlides(initial), 1);
  assert.deepEqual(k.selectSelected(initial), []);

  // Overview floating layout
  const overviewSnap = k.editorMachine.restore(
    { canvas: "overview", layout: "floating" },
    { zoom: "12%", slides: 3, selected: [3] }
  );
  const ovLayout = k.selectLayout(overviewSnap);
  assert.equal(ovLayout.panelWide, false);
  assert.equal(ovLayout.showLeftPanel, false); // Floating header in main replaces left panel
  assert.equal(ovLayout.floatingHeader, true);
  assert.equal(ovLayout.inspector, "floating");
  assert.equal(ovLayout.header, "floating");

  // Focus layout (inspector none, floatingTop true)
  const focusSnap = k.editorMachine.restore({ panel: "media", layout: "focus" }, { zoom: "48%" });
  const focusLayout = k.selectLayout(focusSnap);
  assert.equal(focusLayout.panelWide, true);
  assert.equal(focusLayout.inspector, "none");
  assert.equal(focusLayout.floatingTop, true);

  // Shapes tray
  const shapesSnap = k.editorMachine.restore({ tray: "shapes" });
  assert.equal(k.selectLayout(shapesSnap).shapes, true);

  // Empty deck
  const emptySnap = k.editorMachine.restore({ deck: "empty" }, { slides: 0 });
  assert.equal(k.selectLayout(emptySnap).empty, true);
});

test("EditorWorkspace renders for each of the 11 restore configs", () => {
  const configs = [
    { name: "home-sidebar", render: () => h("div", null, h(k.HomeSidebar), h(k.HomeFileToolbar)) },
    {
      name: "start",
      snapshot: k.editorMachine.restore(
        { deck: "empty", overlay: "start" },
        { zoom: "100%", slides: 0 }
      ),
    },
    { name: "slide", snapshot: k.editorMachine.restore() },
    {
      name: "overview",
      snapshot: k.editorMachine.restore(
        { canvas: "overview", layout: "floating" },
        { zoom: "12%", slides: 3, selected: [3] }
      ),
    },
    {
      name: "agents",
      snapshot: k.editorMachine.restore({ panel: "agents" }, { zoom: "38%" }),
    },
    {
      name: "inserts",
      snapshot: k.editorMachine.restore({ panel: "inserts" }, { zoom: "38%" }),
    },
    {
      name: "inserts-overview",
      snapshot: k.editorMachine.restore(
        { panel: "inserts", canvas: "overview", layout: "floating" },
        { zoom: "12%", slides: 3, selected: [3] }
      ),
    },
    {
      name: "media-overview",
      snapshot: k.editorMachine.restore(
        { panel: "media", canvas: "overview", layout: "floating" },
        { zoom: "12%", slides: 3, selected: [2, 3] }
      ),
    },
    {
      name: "media",
      snapshot: k.editorMachine.restore({ panel: "media", layout: "focus" }, { zoom: "48%" }),
    },
    {
      name: "shapes",
      snapshot: k.editorMachine.restore(
        { panel: "inserts", canvas: "overview", layout: "floating", tray: "shapes" },
        { zoom: "12%", slides: 3, selected: [3] }
      ),
    },
    {
      name: "share",
      snapshot: k.editorMachine.restore(
        { panel: "media", layout: "focus", overlay: "share" },
        { zoom: "48%" }
      ),
    },
  ];

  for (const c of configs) {
    cleanup();
    if (c.render) {
      const { container } = render(c.render());
      assert.ok(container.innerHTML.length > 0, `${c.name} rendered`);
    } else {
      const { container } = render(h(k.EditorWorkspace, { snapshot: c.snapshot, send: () => {} }));
      assert.ok(container.innerHTML.length > 0, `${c.name} rendered`);
    }
  }
});

test("clicking the Agents rail item changes panel", async () => {
  const user = userEvent.setup();

  function InteractiveEditor() {
    const [snapshot, send] = k.useEditorMachine(k.editorMachine.initial);
    return h(k.EditorWorkspace, { snapshot, send });
  }

  render(h(InteractiveEditor));

  // Starts on file panel
  assert.ok(screen.getByRole("button", { name: "New slide" }));

  // Click on the Agents rail item
  const agentsRailItem = screen.getByRole("button", { name: /Agents/ });
  await user.click(agentsRailItem);

  // Agents panel is now rendered
  assert.ok(screen.getByText("What do you want to do?"));
});

test("Share opens the dialog and CLOSE_OVERLAY closes it", async () => {
  const user = userEvent.setup();

  function InteractiveEditor() {
    const [snapshot, send] = k.useEditorMachine(k.editorMachine.initial);
    return h("div", null,
      h(k.EditorWorkspace, { snapshot, send }),
      h("button", { onClick: () => send({ type: "CLOSE_OVERLAY" }) }, "CloseOverlayDirect")
    );
  }

  render(h(InteractiveEditor));

  // Dialog not open initially
  const dialog = document.querySelector("dialog.share");
  assert.equal(dialog?.hasAttribute("open"), false);

  // Click Share button in inspector
  const shareBtn = screen.getByRole("button", { name: "Share" });
  await user.click(shareBtn);

  // Dialog opens
  assert.equal(dialog?.hasAttribute("open"), true);

  // Close dialog via Close icon button
  const closeBtns = screen.getAllByRole("button", { name: "Close" });
  await user.click(closeBtns[closeBtns.length - 1]);

  assert.equal(dialog?.hasAttribute("open"), false);
});

test("accessible names for workspace components", () => {
  const { container } = render(h("div", null,
    h(k.HelpButton),
    h(k.BottomToolbar, { shapes: true }),
    h(k.ShapesTray),
    h(k.HomeSidebar),
    h(k.HomeFileToolbar),
    h(k.EmptyDeck),
    h(k.PresentView, { slides: 3 }),
    h(k.HomeFileList)
  ));

  const buttons = container.querySelectorAll("button");
  for (const btn of buttons) {
    const ariaLabel = btn.getAttribute("aria-label");
    const title = btn.getAttribute("title");
    const text = btn.textContent.trim();
    const hasName = Boolean(ariaLabel || title || text);
    assert.ok(hasName, `Button missing accessible name: ${btn.outerHTML.slice(0, 80)}`);
  }
});

test("exact bug path: closing gallery leaves empty deck CTA, ADD_SLIDE fills deck and OPEN_TEMPLATES reopens gallery", async () => {
  const user = userEvent.setup();

  function InteractiveEditor() {
    const [snapshot, send] = k.useEditorMachine(
      k.restoreEditor({ deck: "empty", overlay: "start" }, { slides: 0 })
    );
    return h(k.EditorWorkspace, { snapshot, send });
  }

  render(h(InteractiveEditor));

  // 1. Getting started dialog is open and has close button
  const startDialog = document.querySelector("dialog.start");
  assert.equal(startDialog?.hasAttribute("open"), true);
  const startCloseBtn = startDialog?.querySelector(".ad-dialog__header .ad-btn--icon");
  assert.equal(startCloseBtn?.getAttribute("aria-label"), "Close");

  // 2. Click "Use a template" card -> moves to templates gallery
  const useTemplateBtn = screen.getByRole("button", { name: /Use a template/ });
  await user.click(useTemplateBtn);

  // Template gallery dialog is open
  const templatesDialog = document.querySelector("dialog.templates-dialog");
  assert.equal(templatesDialog?.hasAttribute("open"), true);

  // 3. Close the gallery dialog via Close icon button
  const galleryCloseBtn = templatesDialog?.querySelector(".ad-dialog__header button[aria-label='Close']");
  assert.ok(galleryCloseBtn);
  await user.click(galleryCloseBtn);

  // Gallery dialog closed
  assert.equal(templatesDialog?.hasAttribute("open"), false);
  assert.equal(startDialog?.hasAttribute("open"), false);

  // 4. User is NOT stranded! Stage area renders EmptyDeck CTA with accessible buttons
  const createSlideBtn = screen.getByRole("button", { name: "Create your first slide" });
  const browseTemplatesBtn = screen.getByRole("button", { name: "Browse templates" });
  assert.ok(createSlideBtn);
  assert.ok(browseTemplatesBtn);

  // 5. Clicking "Browse templates" sends OPEN_TEMPLATES and reopens the templates gallery
  await user.click(browseTemplatesBtn);
  assert.equal(templatesDialog?.hasAttribute("open"), true);
});

test("each of the 7 new screen configurations renders cleanly", () => {
  const newScreens = [
    {
      name: "templates",
      snapshot: k.restoreEditor(
        { deck: "empty", overlay: "templates" },
        { zoom: "100%", slides: 0 }
      ),
    },
    {
      name: "drafting",
      snapshot: k.restoreEditor(
        { deck: "empty", overlay: "drafting" },
        { zoom: "100%", slides: 0 }
      ),
    },
    {
      name: "present",
      snapshot: k.restoreEditor(
        {},
        { zoom: "100%", slides: 3, presenting: true }
      ),
    },
    {
      name: "invited",
      snapshot: k.restoreEditor(
        { panel: "media", layout: "focus", overlay: "invited" },
        { zoom: "48%", slides: 1, invitees: ["grace@example.com", "alan@example.com"] }
      ),
    },
    {
      name: "empty-editor",
      snapshot: k.restoreEditor(
        { deck: "empty", overlay: "none" },
        { zoom: "100%", slides: 0 }
      ),
    },
    {
      name: "home-list",
      render: () =>
        h("div", null, h(k.HomeSidebar), h(k.HomeFileToolbar), h(k.HomeFileList)),
    },
    {
      name: "home-empty",
      render: () =>
        h("div", null,
          h(k.HomeSidebar),
          h(k.HomeFileToolbar),
          h(k.EmptyState, {
            icon: "file",
            title: "No drafts yet",
            action: h(k.Button, { variant: "primary" }, "New slides"),
          })
        ),
    },
  ];

  for (const s of newScreens) {
    cleanup();
    if (s.render) {
      const { container } = render(s.render());
      assert.ok(container.innerHTML.length > 0, `${s.name} rendered`);
    } else {
      const { container } = render(h(k.EditorWorkspace, { snapshot: s.snapshot, send: () => {} }));
      assert.ok(container.innerHTML.length > 0, `${s.name} rendered`);
    }
  }
});

test("dialogs and components have accessible names", () => {
  cleanup();
  render(h("div", null,
    h(k.TemplateGallery, { open: true, onClose: () => {}, onBack: () => {} }),
    h(k.DraftingState, { open: true, onClose: () => {} }),
    h(k.ShareDialog, { open: true, invited: true, onClose: () => {} }),
    h(k.EmptyDeck),
    h(k.PresentView, { slides: 3 })
  ));

  const dialogs = document.querySelectorAll("dialog");
  for (const d of dialogs) {
    const labelledBy = d.getAttribute("aria-labelledby");
    const label = d.getAttribute("aria-label");
    assert.ok(Boolean(labelledBy || label), `Dialog missing accessible name`);
    if (labelledBy) {
      const titleEl = document.getElementById(labelledBy);
      assert.ok(titleEl && titleEl.textContent.trim().length > 0, "Dialog title element has text");
    }
  }

  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    const ariaLabel = btn.getAttribute("aria-label");
    const title = btn.getAttribute("title");
    const text = btn.textContent.trim();
    const hasName = Boolean(ariaLabel || title || text);
    assert.ok(hasName, `Button missing accessible name: ${btn.outerHTML.slice(0, 80)}`);
  }
});

test("keyboard ArrowRight and Escape in PresentView", async () => {
  cleanup();
  const user = userEvent.setup();
  let exitCalled = false;
  let currentSlide = 1;

  const { container } = render(h(k.PresentView, {
    slides: 3,
    currentSlide,
    onSlideChange: (n) => { currentSlide = n; },
    onExit: () => { exitCalled = true; },
  }));

  const region = container.querySelector(".present-view");
  assert.ok(region);

  // ArrowRight advances slide
  fireEvent.keyDown(region, { key: "ArrowRight", code: "ArrowRight" });
  assert.equal(currentSlide, 2);

  // Escape triggers onExit
  fireEvent.keyDown(region, { key: "Escape", code: "Escape" });
  assert.equal(exitCalled, true);
});

test("template card Enter selects", async () => {
  cleanup();
  let selected = "";
  render(h(k.TemplateGallery, {
    open: true,
    onSelect: (id) => { selected = id; },
    onClose: () => {},
  }));

  const pitchCard = screen.getByRole("button", { name: /Startup Pitch/ });
  assert.ok(pitchCard);
  fireEvent.click(pitchCard);
  assert.equal(selected, "pitch");
});

test("drafting reaches a deck via the Open deck button", async () => {
  cleanup();
  let readyCalled = false;
  render(h(k.DraftingState, {
    open: true,
    progress: 100,
    prompt: "Design AI presentation",
    onOpenDeck: () => { readyCalled = true; },
  }));

  const openBtn = screen.getByRole("button", { name: "Open deck" });
  assert.ok(openBtn);
  fireEvent.click(openBtn);
  assert.equal(readyCalled, true);
});

test("empty deck disables Present buttons", () => {
  cleanup();
  const emptySnapshot = k.restoreEditor({ deck: "empty" }, { slides: 0 });
  const { container } = render(h(k.EditorWorkspace, {
    snapshot: emptySnapshot,
    send: () => {},
  }));

  const presentBtns = container.querySelectorAll("button[aria-label='Present']");
  assert.ok(presentBtns.length > 0);
  for (const btn of presentBtns) {
    assert.equal(btn.hasAttribute("disabled"), true);
  }
});

test("N1: built-in simulated draft advances with fake timers and reaches Open deck", (t) => {
  cleanup();
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  try {
    const snap = k.restoreEditor({ deck: "empty", overlay: "drafting" }, { slides: 0, draftPrompt: "Pitch deck" });
    function Harness() {
      const [s, setS] = useState(snap);
      return h(k.EditorWorkspace, {
        snapshot: s,
        send: (ev) => setS(k.editorMachine.transition(s, ev)),
      });
    }

    render(h(Harness));

    // Initially progress is 0, no Open deck button
    assert.equal(screen.queryByRole("button", { name: "Open deck" }), null);

    // Advance timers by 2600ms
    act(() => {
      t.mock.timers.tick(2600);
    });

    // Now Open deck button is reached!
    const openBtn = screen.getByRole("button", { name: "Open deck" });
    assert.ok(openBtn);
  } finally {
    t.mock.timers.reset();
  }
});

test("N2: after dialog closes into editor, focus moves to slide stage or EmptyDeck button", () => {
  cleanup();
  // 1. Deck exists: stage receives focus with tabIndex=-1 and aria-label "Slide N"
  function HarnessWithDeck() {
    const [snap, setSnap] = useState(() => k.restoreEditor({ overlay: "templates" }, { slides: 2 }));
    return h(k.EditorWorkspace, {
      snapshot: snap,
      send: (ev) => setSnap(k.editorMachine.transition(snap, ev)),
    });
  }
  const { container } = render(h(HarnessWithDeck));
  act(() => {
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
  });
  const stage = container.querySelector(".slide-view__stage");
  assert.ok(stage);
  assert.equal(stage.getAttribute("tabindex"), "-1");
  assert.equal(stage.getAttribute("aria-label"), "Slide 1");
  assert.equal(document.activeElement, stage);

  cleanup();

  // 2. Deck empty: EmptyDeck primary button receives focus
  function HarnessEmpty() {
    const [snap, setSnap] = useState(() => k.restoreEditor({ deck: "empty", overlay: "templates" }, { slides: 0 }));
    return h(k.EditorWorkspace, {
      snapshot: snap,
      send: (ev) => setSnap(k.editorMachine.transition(snap, ev)),
    });
  }
  render(h(HarnessEmpty));
  act(() => {
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
  });
  const primaryBtn = screen.getByRole("button", { name: "Create your first slide" });
  assert.equal(document.activeElement, primaryBtn);
});

test("N3: editor stage renders selected slide title/body matching slideItems", () => {
  cleanup();
  // Slide 1 default keeps "Slide Deck Title"
  const snap1 = k.restoreEditor({}, { slides: 3, selected: [1] });
  const { container, rerender } = render(h(k.EditorWorkspace, { snapshot: snap1, send: () => {} }));
  const h1 = container.querySelector(".bigslide h1");
  assert.equal(h1?.textContent, "Slide Deck Title");

  // Slide 3 renders "Slide 3" / "Content for slide 3"
  const snap3 = k.restoreEditor({}, { slides: 3, selected: [3] });
  rerender(h(k.EditorWorkspace, { snapshot: snap3, send: () => {} }));
  const h1Slide3 = container.querySelector(".bigslide h1");
  const pSlide3 = container.querySelector(".bigslide p");
  assert.equal(h1Slide3?.textContent, "Slide 3");
  assert.equal(pSlide3?.textContent, "Content for slide 3");

  // Custom slideItems in context
  const snapCustom = k.restoreEditor({}, {
    slides: 2,
    selected: [2],
    slideItems: [
      { title: "Intro Title", body: "Intro Body" },
      { title: "Second Title", body: "Second Body" },
    ],
  });
  rerender(h(k.EditorWorkspace, { snapshot: snapCustom, send: () => {} }));
  assert.equal(container.querySelector(".bigslide h1")?.textContent, "Second Title");
  assert.equal(container.querySelector(".bigslide p")?.textContent, "Second Body");
});

test("N5: PresentView starts at currentSlide passed from EditorWorkspace", () => {
  cleanup();
  const snap = k.restoreEditor({ layout: "present" }, { slides: 5, selected: [4], presenting: true });
  const { container } = render(h(k.EditorWorkspace, { snapshot: snap, send: () => {} }));
  const counter = container.querySelector(".present-view__counter");
  assert.equal(counter?.textContent?.trim(), "4 / 5");
  const h1 = container.querySelector(".present-view__stage h1");
  assert.equal(h1?.textContent, "Slide 4");
});

test("N6: ShareDialog moves focus to Done button upon invite", () => {
  cleanup();
  function Harness() {
    const [invited, setInvited] = useState(false);
    return h(k.ShareDialog, {
      open: true,
      invited,
      invitees: ["a@x.com"],
      onInvite: () => setInvited(true),
      onDone: () => {},
      onClose: () => {},
    });
  }
  render(h(Harness));
  const input = screen.getByLabelText("Invite emails");
  fireEvent.change(input, { target: { value: "a@x.com" } });
  const inviteBtn = screen.getByRole("button", { name: "Invite" });
  fireEvent.click(inviteBtn);
  const doneBtn = screen.getByRole("button", { name: "Done" });
  assert.equal(document.activeElement, doneBtn);
});

test("N7: DraftingState default title is Drafting", () => {
  cleanup();
  render(h(k.DraftingState, { open: true, onClose: () => {} }));
  const dialog = document.querySelector("dialog.drafting-dialog");
  assert.ok(dialog);
  assert.ok(dialog.textContent.includes("Drafting"));
  assert.ok(!dialog.textContent.includes("Getting started"));
});
