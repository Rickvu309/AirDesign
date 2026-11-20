import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { layersCopy } from "../../apps/web/src/copy/layers-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { savedExport } from "./export-dialog"

const slidePart = "ppt/slides/slide1.xml"

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

test.use({ viewport: { width: 1600, height: 1000 } })

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function stays(locator: Locator, at: Placed): Promise<void> {
  await expect
    .poll(async () => {
      const now = await placed(locator)
      return Math.max(
        Math.abs(now.x - at.x),
        Math.abs(now.y - at.y),
        Math.abs(now.width - at.width),
        Math.abs(now.height - at.height),
      )
    })
    .toBeLessThanOrEqual(1.5)
}

async function dragOnto(page: Page, from: Locator, to: Locator, share: number, mark: string): Promise<void> {
  const start = await placed(from)
  const end = await placed(to)
  await page.mouse.move(start.x + 60, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + 60, end.y + end.height * share, { steps: 8 })
  await page.mouse.move(end.x + 61, end.y + end.height * share)
  await expect(page.locator(`[data-layers-panel] [data-layer-drop="${mark}"]`)).toBeVisible()
  await page.mouse.up()
}

test("a layer drags into a group and out again in the layers panel, in place and as one undo, and exports as the group's child @export", async ({
  page,
}, testInfo) => {
  await openDeck(page, "blank.pptx")
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle, shapeCopy.shapes.triangle])
    await insert(page, name ?? "")
  const [square, circle, triangle] = [painted(page, 4), painted(page, 5), painted(page, 6)]
  await expect(triangle).toBeVisible()
  await square.click()
  await circle.click({ modifiers: ["Shift"] })
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(painted(page, 7)).toHaveCount(1)
  const where = await Promise.all([square, circle, triangle].map(placed))

  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  const row = (shape: number) => layers.locator(`[data-layer-row$=".${String(shape)}"]`)
  await expect(row(7)).toHaveAttribute("aria-level", "1")
  await expect(row(6)).toHaveAttribute("aria-level", "1")
  const triangleName = (await row(6).locator("[data-layer-name]").textContent()) ?? ""
  const groupName = (await row(7).locator("[data-layer-name]").textContent()) ?? ""

  await dragOnto(page, row(6), row(7), 0.5, "inside")
  await expect(row(6)).toHaveAttribute("aria-level", "2")
  await expect(row(7)).toHaveAttribute("aria-expanded", "true")
  await stays(triangle, where[2]!)
  await stays(square, where[0]!)
  await expect(layers.locator("[data-announcer]")).toHaveText(layersCopy.movedInto(triangleName, groupName))

  await page.getByRole("button", { name: undoCopy.undoNamed["layer-order"], exact: true }).click()
  await expect(row(6)).toHaveAttribute("aria-level", "1")
  await stays(triangle, where[2]!)
  await page.getByRole("button", { name: undoCopy.redoNamed["layer-order"], exact: true }).click()
  await expect(row(6)).toHaveAttribute("aria-level", "2")
  await stays(triangle, where[2]!)

  await dragOnto(page, row(5), row(7), 0.1, "above")
  await expect(row(5)).toHaveAttribute("aria-level", "1")
  await stays(circle, where[1]!)
  await stays(triangle, where[2]!)

  const eyes = [row(5), row(7)].map((each) => each.locator("[data-layer-eye]"))
  await row(5).hover()
  const first = await placed(eyes[0]!)
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await row(7).hover()
  const second = await placed(eyes[1]!)
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(row(5)).toHaveAttribute("data-layer-hidden", "")
  await expect(row(7)).toHaveAttribute("data-layer-hidden", "")
  await expect(circle).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed.hide, exact: true }).click()
  await expect(row(5)).not.toHaveAttribute("data-layer-hidden", "")
  await expect(row(7)).not.toHaveAttribute("data-layer-hidden", "")
  await expect(circle).toBeVisible()

  const exported = testInfo.outputPath("exported-layer-join.pptx")
  await savedExport(page, exported)
  await copyFile(exported, join(process.cwd(), "tests/browser/exported-layer-join.pptx"))
})
