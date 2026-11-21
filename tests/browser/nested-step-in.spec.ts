import { expect, type Locator, type Page } from "@playwright/test"
import { decksOn, test } from "./deck-test"
import { openDeck } from "./design-panel"

const slidePart = "ppt/slides/slide1.xml"

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type Shift = { readonly x: number; readonly y: number }

test.use({ viewport: { width: 1600, height: 1000 } })

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

function shift(from: Placed, now: Placed): Shift {
  return { x: now.x - from.x, y: now.y - from.y }
}

function same(left: Shift, right: Shift): boolean {
  return Math.abs(left.x - right.x) <= 1.5 && Math.abs(left.y - right.y) <= 1.5
}

const still: Shift = { x: 0, y: 0 }

test("double-click steps into nested groups one level at a time, and the inner group carries its layers while dragged", async ({
  page,
}) => {
  await openDeck(page, "nested-groups.pptx")
  const selection = page.locator("[data-slide-paint] [data-selection]")
  const [leaf, twin, beside] = [painted(page, 4), painted(page, 5), painted(page, 6)]
  await leaf.click()
  await expect(selection).toHaveAttribute("data-selection", /\.2$/)
  await leaf.dblclick()
  await expect(selection).toHaveAttribute("data-selection", /\.3$/)
  await leaf.dblclick()
  await expect(selection).toHaveAttribute("data-selection", /\.4$/)
  await page.keyboard.press("Escape")
  await expect(selection).toHaveAttribute("data-selection", /\.3$/)

  const [leafFrom, twinFrom, besideFrom] = await Promise.all([leaf, twin, beside].map(placed))
  const press = { x: leafFrom.x + leafFrom.width / 2, y: leafFrom.y + leafFrom.height / 2 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 80, press.y + 40, { steps: 10 })
  await expect.poll(async () => shift(leafFrom, await placed(leaf)).x).toBeGreaterThan(40)
  const dragged = shift(leafFrom, await placed(leaf))
  expect(same(shift(twinFrom, await placed(twin)), dragged)).toBe(true)
  expect(same(shift(besideFrom, await placed(beside)), still)).toBe(true)
  await page.mouse.up()
  await expect.poll(async () => same(shift(leafFrom, await placed(leaf)), dragged)).toBe(true)
  await page.reload()
  await decksOn(page).ready()
  await expect.poll(async () => same(shift(twinFrom, await placed(twin)), dragged)).toBe(true)
  await expect.poll(async () => same(shift(besideFrom, await placed(beside)), still)).toBe(true)
})
