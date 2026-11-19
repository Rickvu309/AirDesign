import { expect, test, type Page } from "@playwright/test"
import { layersCopy } from "../../apps/web/src/copy/layers-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"

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
    .evaluateAll((all, name) => all.map((each) => each.getAttribute(name)?.split("#")[1]), mark)
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
