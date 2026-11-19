import { expect } from "@playwright/test"
import { fixtureDeck } from "./fixture-deck.mjs"
import { setPanelMode } from "./panel-mode.mjs"

const element = (number) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${number}"]`

const kinds = {
  text: { fixture: "clean.pptx", text: true },
  shape: { fixture: "shapes-added.pptx", elements: [4] },
  picture: { fixture: "picture-png.pptx", elements: [4] },
  connector: { fixture: "shapes-added.pptx", elements: [6] },
  pair: { fixture: "shapes-added.pptx", elements: [4, 5] },
  frame: { fixture: "shapes-added.pptx", elements: [4, 5], wrap: true },
  slide: { fixture: "clean.pptx", elements: [] },
}

export const panelKinds = Object.keys(kinds)

export async function reachPanel(kit, kind, mode) {
  const { fixture, text = false, elements = [], wrap = false } = kinds[kind]
  await fixtureDeck(kit, fixture)
  const { page } = kit
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await setPanelMode(page, mode)
  if (text) {
    await page.locator('[data-slide-paint] [contenteditable="true"]').click()
  }
  for (const [index, number] of elements.entries()) {
    const box = await page.locator(element(number)).boundingBox()
    if (index > 0) await page.keyboard.down("Shift")
    await page.mouse.click(box.x + Math.min(4, box.width / 2), box.y + Math.min(4, box.height / 2))
    if (index > 0) await page.keyboard.up("Shift")
  }
  if (elements.length > 1) await expect(page.locator("[data-chosen]")).toHaveCount(elements.length)
  if (wrap) {
    await page.keyboard.press("Shift+A")
    await expect(page.locator('[data-panel-kind="frame"]')).toBeVisible()
  }
  await expect(page.locator(kind === "slide" ? "[data-design-panel]" : "[data-design-element]")).toBeVisible()
  await page.mouse.move(4, 4)
  await page.locator("[data-design-panel]").evaluate((panel) => {
    panel.scrollTop = 0
  })
}

export function panelState(kind, mode) {
  return {
    name: mode === "slides" ? `panel-${kind}` : `panel-${kind}-design`,
    design: null,
    drive: (kit) => reachPanel(kit, kind, mode),
  }
}
