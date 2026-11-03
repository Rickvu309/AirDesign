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
const { render, cleanup, screen } = await import("@testing-library/react");
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
    h(k.HomeFileToolbar)
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
