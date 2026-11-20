import { join } from "node:path"
import type { Locator, Page } from "@playwright/test"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { expect, test } from "./deck-test"
import { fixtures } from "./design-panel"

const slidePart = "ppt/slides/slide1.xml"

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

test.use({ viewport: { width: 1600, height: 1000 } })

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function at(locator: Locator, wanted: Placed): Promise<void> {
  await expect
    .poll(async () => {
      const now = await placed(locator)
      return Math.max(Math.abs(now.x - wanted.x), Math.abs(now.y - wanted.y), Math.abs(now.width - wanted.width))
    })
    .toBeLessThanOrEqual(1.5)
}

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

test("a layer inside a group inside a frame moves where it is dropped, and the group grows to hold it", async ({
  page,
  decks,
}) => {
  await decks.open(join(fixtures, "blank.pptx"))
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle]) await insert(page, name ?? "")
  const [square, circle] = [painted(page, 4), painted(page, 5)]
  await expect(circle).toBeVisible()
  await square.click()
  await page.keyboard.down("ShiftLeft")
  await circle.click()
  await page.keyboard.up("ShiftLeft")
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(painted(page, 6)).toHaveCount(1)
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  await page.locator("[data-design-mode]").click()
  await expect(page.locator('[data-layers-panel] [data-layer-kind="frame"]')).toHaveCount(1)

  const [from, still, group] = await Promise.all([square, circle, painted(page, 6)].map(placed))
  await square.click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.4$/)
  const press = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x, press.y + 160, { steps: 8 })
  await page.mouse.up()
  const dropped = await placed(square)
  expect(dropped.y - from.y).toBeGreaterThan(100)
  await at(circle, still)
  await expect.poll(async () => (await placed(painted(page, 6))).height).toBeGreaterThan(group.height + 100)
  await page.reload()
  await decks.ready()
  await at(painted(page, 4), dropped)
})
