import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { layersCopy } from "../../apps/web/src/copy/layers-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { savedExport } from "./export-dialog"
import { covers } from "./gesture"

const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

function paintedOrder(page: Page, where: string, mark: string) {
  return page
    .locator(`${where} [${mark}$="#4"], ${where} [${mark}$="#5"]`)
    .evaluateAll((all, name) => all.map((each) => /(\d+)$/.exec(each.getAttribute(name) ?? "")?.[1]), mark)
}

test("the layers panel lists a slide's layers front first, selects, renames and reorders them", async ({ page }) => {
  await openDeck(page, "blank.pptx")
  await insert(page, shapeCopy.shapes.square)
  await insert(page, shapeCopy.shapes.circle)
  await expect(page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#5"]`)).toBeVisible()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByRole("heading", { name: layersCopy.section })).toBeVisible()
  const rows = layers.getByRole("treeitem")
  await expect(rows).toHaveCount(4)
  const names = async () => (await layers.locator("[data-layer-name]").allTextContents()).slice(0, 2)
  const [circle, square] = await names()
  if (circle === undefined || square === undefined) throw new Error("no layers")

  await rows.nth(1).hover()
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(1)
  await rows.nth(1).click()
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await rows.nth(0).click({ modifiers: ["Shift"] })
  await expect(layers.locator("[data-layer-selected]")).toHaveCount(2)
  await rows.nth(0).click({ modifiers: ["ControlOrMeta"] })
  await expect(layers.locator("[data-layer-selected]")).toHaveCount(1)

  await rows.nth(0).dblclick()
  const field = layers.locator("[data-layer-name-field]")
  await expect(field).toBeFocused()
  await field.fill("Badge")
  await field.press("Escape")
  await expect(rows.nth(0)).toHaveAccessibleName(circle)
  await rows.nth(0).dblclick()
  await field.fill("Badge")
  await field.press("Enter")
  await expect(rows.nth(0)).toHaveAccessibleName("Badge")

  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 40, y: 3 } })
  await expect.poll(names).toEqual([square, "Badge"])
  await expect.poll(() => paintedOrder(page, "[data-slide-paint]", "data-canvas-element")).toEqual(["5", "4"])
  await expect.poll(() => paintedOrder(page, "[data-slide-entry='1']", "data-thumb-element")).toEqual(["5", "4"])
  await page.getByRole("button", { name: undoCopy.undoNamed["layer-order"], exact: true }).click()
  await expect.poll(names).toEqual(["Badge", square])
  await expect.poll(() => paintedOrder(page, "[data-slide-paint]", "data-canvas-element")).toEqual(["4", "5"])
})

test("a layer hides from its eye in the layers panel and with Ctrl+Shift+H, and stays selectable there", async ({
  page,
}) => {
  covers("hide")
  await openDeck(page, "blank.pptx")
  await insert(page, shapeCopy.shapes.square)
  const square = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#4"]`)
  await expect(square).toBeVisible()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  const row = layers.getByRole("treeitem").first()
  const name = (await row.locator("[data-layer-name]").textContent()) ?? ""
  await row.hover()
  await layers.getByRole("button", { name: layersCopy.hide(name), exact: true }).click()
  await expect(square).toHaveCount(0)
  await expect(row).toHaveAttribute("data-layer-hidden", "")
  await expect(page.locator(`[data-slide-entry='1'] [data-thumb-element="${slidePart}#4"]`)).toHaveCount(0)
  await row.click()
  await expect(row).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("ControlOrMeta+Shift+KeyH")
  await expect(square).toBeVisible()
  await expect(row).not.toHaveAttribute("data-layer-hidden", "")
  await expect(layers.getByRole("button", { name: layersCopy.show(name), exact: true })).toHaveCount(0)
  await square.click()
  await page.keyboard.press("ControlOrMeta+Shift+KeyH")
  await expect(square).toHaveCount(0)
  await expect(row).toHaveAttribute("aria-selected", "true")
  await page.getByRole("button", { name: undoCopy.undoNamed.hide, exact: true }).click()
  await expect(square).toBeVisible()
})

test("a hidden layer inside a frame stays selected in the layers panel", async ({ page }) => {
  await openDeck(page, "frame.pptx")
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await layers.locator("[data-layer-caret]").first().click()
  const row = layers.getByRole("treeitem").nth(1)
  await row.click()
  await expect(row).toHaveAttribute("aria-selected", "true")
  await row.hover()
  await row.locator("[data-layer-eye]").click()
  await expect(row).toHaveAttribute("data-layer-hidden", "")
  await expect(row).toHaveAttribute("aria-selected", "true")
})

test("a locked layer lets clicks pass on the slide, unlocks with Ctrl+Shift+L, and exports its PowerPoint locks @export", async ({
  page,
}, testInfo) => {
  covers("lock")
  await openDeck(page, "clean.pptx")
  const shape = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#2"]`)
  await expect(shape).toBeVisible()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  const row = layers.getByRole("treeitem").first()
  const name = (await row.locator("[data-layer-name]").textContent()) ?? ""
  await row.hover()
  await layers.getByRole("button", { name: layersCopy.lock(name), exact: true }).click()
  await expect(row).toHaveAccessibleName(`${name}, ${layersCopy.locked}`)
  await expect.poll(() => shape.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none")
  const box = await shape.boundingBox()
  if (box === null) throw new Error("no shape")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(0)
  await expect(row).toHaveAttribute("aria-selected", "false")
  await row.click()
  await expect(row).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("ControlOrMeta+Shift+KeyL")
  await expect(row).toHaveAccessibleName(name)
  await expect.poll(() => shape.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("auto")
  await page.keyboard.press("ControlOrMeta+Shift+KeyL")
  await expect(row).toHaveAccessibleName(`${name}, ${layersCopy.locked}`)
  await page.getByRole("button", { name: undoCopy.undoNamed.lock, exact: true }).click()
  await expect(row).toHaveAccessibleName(name)
  await page.getByRole("button", { name: undoCopy.redoNamed.lock, exact: true }).click()
  await expect(row).toHaveAccessibleName(`${name}, ${layersCopy.locked}`)
  const exported = testInfo.outputPath("exported-layer-lock.pptx")
  await savedExport(page, exported)
  await copyFile(exported, join(process.cwd(), "tests/browser/exported-layer-lock.pptx"))
})
