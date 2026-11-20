import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { covers } from "./gesture"
import { test } from "./deck-test"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

function shapeAt(page: Page, number: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(number)}"]`)
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function dragMouse(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

async function placeShape(
  page: Page,
  name: string,
  shapeNumber: number,
  target: { readonly x: number; readonly y: number },
): Promise<Locator> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  const layer = shapeAt(page, shapeNumber)
  await expect(layer).toBeVisible()
  const box = await boxOf(layer)
  await dragMouse(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: target.x, y: target.y })
  return layer
}

test("marquee, Shift-marquee, Cmd/Ctrl deep-select, Escape to parent, Enter, Tab and hover match Figma", async ({
  page,
  decks,
}) => {
  covers("marquee", "deep-select", "select-parent", "select-add", "step-in", "select-next", "deselect")
  await decks.open(blank)
  const slide = await boxOf(page.locator("[data-slide-paint]"))
  await dragMouse(
    page,
    { x: slide.x + 20, y: slide.y + 20 },
    { x: slide.x + slide.width - 20, y: slide.y + slide.height - 20 },
  )
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(0)

  const one = await placeShape(page, shapeCopy.shapes.square!, 4, { x: slide.x + 140, y: slide.y + 130 })
  const two = await placeShape(page, shapeCopy.shapes.circle!, 5, { x: slide.x + 300, y: slide.y + 130 })
  const three = await placeShape(page, shapeCopy.shapes.triangle!, 6, { x: slide.x + 460, y: slide.y + 130 })
  const four = await placeShape(page, shapeCopy.shapes.diamond!, 7, { x: slide.x + 180, y: slide.y + 340 })

  await page.mouse.click(slide.x + slide.width - 20, slide.y + slide.height - 20)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(0)

  const oneBox = await boxOf(one)
  await page.mouse.move(oneBox.x + oneBox.width / 2, oneBox.y + oneBox.height / 2)
  await expect(page.locator("[data-slide-paint] [data-hover-outline]")).toHaveAttribute("data-hover-outline", /\.4$/)

  const threeBox = await boxOf(three)
  await page.mouse.move(slide.x - 24, slide.y + 40)
  await page.mouse.down()
  await page.mouse.move(threeBox.x + 20, threeBox.y + 20, { steps: 6 })
  await expect(page.locator("[data-slide-paint] [data-slide-marquee]")).toBeVisible()
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(3)
  await page.mouse.up()
  await expect(page.locator("[data-slide-paint] [data-slide-marquee]")).toBeHidden()
  await expect(page.locator("[data-slide-paint] [data-selection-around]")).toHaveAttribute("data-selection-around", "3")

  const fourBox = await boxOf(four)
  await page.keyboard.down("Shift")
  await dragMouse(page, { x: slide.x + 40, y: fourBox.y - 20 }, { x: fourBox.x + 20, y: fourBox.y + 20 })
  await page.keyboard.up("Shift")
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(4)
  await expect(page.locator("[data-slide-paint] [data-selection-around]")).toHaveAttribute("data-selection-around", "4")

  await one.click()
  await two.click({ modifiers: ["Shift"] })
  await page.keyboard.press("ControlOrMeta+g")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.group)
  const groupLayer = shapeAt(page, 8)
  await expect(groupLayer).toHaveCount(1)

  await page.mouse.click(slide.x + slide.width - 20, slide.y + slide.height - 20)
  await page.keyboard.down("ControlOrMeta")
  await dragMouse(page, { x: oneBox.x - 16, y: oneBox.y - 16 }, { x: oneBox.x + 20, y: oneBox.y + 20 })
  await page.keyboard.up("ControlOrMeta")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.4$/)

  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.8$/)

  const beforeMove = await boxOf(one)
  await dragMouse(
    page,
    { x: beforeMove.x + beforeMove.width / 2, y: beforeMove.y + beforeMove.height / 2 },
    { x: beforeMove.x + beforeMove.width / 2 + 60, y: beforeMove.y + beforeMove.height / 2 + 20 },
  )
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  await expect.poll(async () => Math.round((await boxOf(one)).x - beforeMove.x)).toBeGreaterThanOrEqual(55)

  await page.keyboard.press("Enter")
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Tab")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.4$/)
  await page.keyboard.press("Tab")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await page.keyboard.press("Shift+Tab")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.4$/)
  await page.keyboard.press("Shift+Enter")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.8$/)

  const movedOne = await boxOf(one)
  await page.mouse.click(movedOne.x + movedOne.width / 2, movedOne.y + movedOne.height / 2, { button: "right" })
  await expect(page.getByRole("menu")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.8$/)
})
