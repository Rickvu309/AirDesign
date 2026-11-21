import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { frameCopy, layoutWords } from "../../apps/web/src/copy/frame-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
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
const right = (box: Placed) => box.x + box.width

test.use({ viewport: { width: 1600, height: 1000 } })

test("a filling layer and a centred row reflow while the frame's side handle is dragged, before the drop", async ({
  page,
}) => {
  covers("resize")
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  const [fill, square, oval] = [painted(page, 3), painted(page, 4), painted(page, 5)]
  const panel = page.locator("[data-design-panel]")
  await oval.click()
  await oval.dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await panel.getByRole("combobox", { name: frameCopy.width, exact: true }).click()
  await page.getByRole("option", { name: layoutWords["width.fill"], exact: true }).click()
  await expect.poll(async () => near(right(await boxOf(oval)), right(await boxOf(fill)))).toBe(true)
  await expect(page.getByRole("option")).toHaveCount(0)
  await oval.click()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-paint] [data-selection]")).not.toHaveAttribute("data-selection", /\.5$/)
  const squareAt = await boxOf(square)

  const grip = await boxOf(page.locator("[data-selection] [data-grip='right']"))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 160, grip.y + grip.height / 2, { steps: 12 })
  await expect.poll(async () => near(right(await boxOf(fill)), grip.x + grip.width / 2 + 160)).toBe(true)
  await expect.poll(async () => near(right(await boxOf(oval)), right(await boxOf(fill)))).toBe(true)
  expect(near((await boxOf(square)).x, squareAt.x)).toBe(true)
  await page.mouse.up()
  await expect.poll(async () => near(right(await boxOf(oval)), right(await boxOf(fill)))).toBe(true)
  const dropped = await boxOf(oval)

  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(async () => (await boxOf(oval)).width < dropped.width - 100).toBe(true)
  await expect.poll(async () => near(right(await boxOf(oval)), right(await boxOf(fill)))).toBe(true)
})
