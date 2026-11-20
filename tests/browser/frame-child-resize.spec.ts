import { expect, test, type Locator, type Page } from "@playwright/test"
import { frameCopy, layoutWords, sizingShown } from "../../apps/web/src/copy/frame-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { decksOn } from "./deck-test"
import { openDeck, setPanelMode } from "./design-panel"
import { covers } from "./gesture"

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const part = "ppt/slides/slide1.xml"

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function boxOf(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

const near = (left: number, right: number) => Math.abs(left - right) <= 1.5

async function stepInto(page: Page, layer: Locator, shape: number): Promise<void> {
  await layer.click()
  await layer.dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute(
    "data-selection",
    new RegExp(`\\.${String(shape)}$`),
  )
}

async function dragRight(page: Page, by: number, done: () => Promise<void>): Promise<void> {
  const grip = await boxOf(page.locator("[data-selection] [data-grip='right']"))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + by, grip.y + grip.height / 2, { steps: 12 })
  await done()
  await page.mouse.up()
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("dragging a side of a layer in an auto layout frame resizes it, and the row and the hugging frame follow live, in one undo step", async ({
  page,
}) => {
  covers("resize", "auto-layout")
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  const [fill, square, oval] = [painted(page, 3), painted(page, 4), painted(page, 5)]
  const [frameAt, squareAt, ovalAt] = await Promise.all([fill, square, oval].map(boxOf))

  await stepInto(page, square, 4)
  const grew = async () => (await boxOf(square)).width - squareAt.width
  const follows = async () => {
    const by = await grew()
    return (
      by > 40 &&
      near((await boxOf(oval)).x, ovalAt.x + by) &&
      near((await boxOf(fill)).width, frameAt.width + by) &&
      near((await boxOf(painted(page, 2))).width, frameAt.width + by)
    )
  }
  await dragRight(page, 80, async () => {
    await expect.poll(follows).toBe(true)
  })
  await expect.poll(follows).toBe(true)
  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(async () => near((await boxOf(square)).width, squareAt.width)).toBe(true)
  expect(near((await boxOf(oval)).x, ovalAt.x)).toBe(true)
  expect(near((await boxOf(fill)).width, frameAt.width)).toBe(true)
  await page.getByRole("button", { name: undoCopy.redoNamed.resize, exact: true }).click()
  await expect.poll(follows).toBe(true)
  await page.reload()
  await decksOn(page).ready()
  await expect.poll(follows).toBe(true)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")

  await page.keyboard.press("Escape")
  await stepInto(page, oval, 5)
  const width = page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.width, exact: true })
  await width.click()
  await page.getByRole("option", { name: layoutWords["width.fill"], exact: true }).click()
  await expect(width).toContainText(sizingShown["width.fill"])
  const filled = await boxOf(oval)
  let shrunk = filled.width
  await dragRight(page, -40, async () => {
    await expect.poll(async () => (await boxOf(oval)).width < filled.width - 20).toBe(true)
    shrunk = (await boxOf(oval)).width
  })
  await expect(width).toContainText(sizingShown["width.fixed"])
  await expect.poll(async () => near((await boxOf(oval)).width, shrunk)).toBe(true)
})
