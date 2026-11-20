import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy.ts"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { covers } from "./gesture"
import { test } from "./deck-test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx")
const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

function shape(page: Page, id: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(id)}"]`)
}

async function styleRect(locator: Locator): Promise<Rect> {
  return locator.evaluate((node: HTMLElement) => ({
    x: Number.parseFloat(node.style.left),
    y: Number.parseFloat(node.style.top),
    width: Number.parseFloat(node.style.width),
    height: Number.parseFloat(node.style.height),
  }))
}

async function rotationOf(locator: Locator): Promise<number> {
  return locator.evaluate((node: HTMLElement) => {
    const match = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(node.style.transform)
    return match === null ? 0 : Number(match[1])
  })
}

async function transformOf(locator: Locator): Promise<string> {
  return locator.evaluate((node: HTMLElement) => node.style.transform)
}

async function centerOf(locator: Locator): Promise<{ readonly x: number; readonly y: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("no box")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test("edge resize, Shift and Alt modifiers, rotate handle with Shift snap, flip shortcuts, and Shift axis-lock move", async ({
  page,
  decks,
}) => {
  covers("rotate", "flip-horizontal", "flip-vertical")
  await decks.open(fixture)

  const first = shape(page, 4)
  await first.click()
  await expect(page.locator("[data-selection] [data-grip]")).toHaveCount(12)

  const beforeEdge = await styleRect(first)
  const rightGrip = await centerOf(page.locator('[data-selection] [data-grip="right"]'))
  await page.mouse.move(rightGrip.x, rightGrip.y)
  await page.mouse.down()
  await page.mouse.move(rightGrip.x + 60, rightGrip.y + 40, { steps: 6 })
  await expect(page.locator('[data-transform-hud="resize"]')).toContainText("×")
  await page.mouse.up()
  await expect(page.locator("[data-transform-hud]")).toHaveCount(0)
  const afterEdge = await styleRect(first)
  expect(afterEdge.width).toBeCloseTo(beforeEdge.width + 60, 0)
  expect(afterEdge.height).toBeCloseTo(beforeEdge.height, 0)
  expect(afterEdge.x).toBeCloseTo(beforeEdge.x, 0)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()

  const beforeShift = await styleRect(first)
  const cornerGrip = await centerOf(page.locator('[data-selection] [data-grip="bottom-right"]'))
  await page.mouse.move(cornerGrip.x, cornerGrip.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(cornerGrip.x + 80, cornerGrip.y + 10, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const afterShift = await styleRect(first)
  expect(afterShift.width).toBeGreaterThan(beforeShift.width + 60)
  expect(afterShift.width / afterShift.height).toBeCloseTo(beforeShift.width / beforeShift.height, 1)

  const beforeAlt = await styleRect(first)
  const altGrip = await centerOf(page.locator('[data-selection] [data-grip="right"]'))
  await page.mouse.move(altGrip.x, altGrip.y)
  await page.keyboard.down("Alt")
  await page.mouse.down()
  await page.mouse.move(altGrip.x + 30, altGrip.y, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Alt")
  const afterAlt = await styleRect(first)
  expect(afterAlt.width).toBeCloseTo(beforeAlt.width + 60, 0)
  expect(afterAlt.x + afterAlt.width / 2).toBeCloseTo(beforeAlt.x + beforeAlt.width / 2, 0)

  const beforeAxis = await styleRect(first)
  const inside = await centerOf(first)
  await page.mouse.move(inside.x, inside.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(inside.x + 70, inside.y + 20, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const afterAxis = await styleRect(first)
  expect(afterAxis.x).toBeCloseTo(beforeAxis.x + 70, 0)
  expect(afterAxis.y).toBeCloseTo(beforeAxis.y, 0)

  const center = await centerOf(first)
  const rotGrip = await centerOf(page.locator('[data-selection] [data-grip="rotate-top-right"]'))
  await page.mouse.move(rotGrip.x, rotGrip.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(center.x + 120, center.y + 40, { steps: 8 })
  await expect(page.locator('[data-transform-hud="rotate"]')).toContainText(designCopy.degrees)
  await page.mouse.up()
  await page.keyboard.up("Shift")
  await expect(page.locator("[data-transform-hud]")).toHaveCount(0)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.rotate, exact: true })).toBeEnabled()
  const snapped = await rotationOf(first)
  expect(snapped).toBeGreaterThan(0)
  expect(snapped % 15).toBe(0)

  await page.reload()
  await decks.ready()
  expect(await rotationOf(shape(page, 4))).toBe(snapped)

  const flipTarget = shape(page, 5)
  await flipTarget.click()
  await page.keyboard.press("Shift+H")
  await expect.poll(() => transformOf(flipTarget)).toContain("scale(-1, 1)")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.flip, exact: true })).toBeEnabled()
  await page.keyboard.press("Shift+V")
  await expect.poll(() => transformOf(flipTarget)).toContain("scale(-1, -1)")
  await page.getByRole("button", { name: undoCopy.undoNamed.flip, exact: true }).click()
  await expect.poll(() => transformOf(flipTarget)).toContain("scale(-1, 1)")
})

test("a two-layer selection resizes and rotates together, each undone in one step", async ({ page, decks }) => {
  await decks.open(fixture)

  const a = shape(page, 4)
  const b = shape(page, 5)
  const startA = await styleRect(a)
  const startB = await styleRect(b)

  await a.click()
  await b.click({ modifiers: ["Shift"] })
  const around = page.locator('[data-selection-around="2"]')
  await expect(around).toBeVisible()
  await expect(around.locator("[data-grip]")).toHaveCount(12)

  const corner = await centerOf(around.locator('[data-grip="bottom-right"]'))
  await page.mouse.move(corner.x, corner.y)
  await page.mouse.down()
  await page.mouse.move(corner.x + 80, corner.y + 40, { steps: 6 })
  await expect(page.locator('[data-transform-hud="resize"]')).toContainText("×")
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()

  const resizedA = await styleRect(a)
  const resizedB = await styleRect(b)
  expect(resizedA.width).toBeGreaterThan(startA.width + 5)
  expect(resizedB.width).toBeGreaterThan(startB.width + 5)

  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(async () => (await styleRect(a)).width).toBeCloseTo(startA.width, 0)
  await expect.poll(async () => (await styleRect(b)).width).toBeCloseTo(startB.width, 0)

  await a.click()
  await b.click({ modifiers: ["Shift"] })
  await expect(around).toBeVisible()
  const aroundCenter = await centerOf(around)
  const rotGrip = await centerOf(around.locator('[data-grip="rotate-top-right"]'))
  await page.mouse.move(rotGrip.x, rotGrip.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(aroundCenter.x + 120, aroundCenter.y + 80, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.rotate, exact: true })).toBeEnabled()

  const rotA = await rotationOf(a)
  const rotB = await rotationOf(b)
  expect(rotA).toBeGreaterThan(0)
  expect(rotA % 15).toBe(0)
  expect(rotB).toBe(rotA)

  await page.getByRole("button", { name: undoCopy.undoNamed.rotate, exact: true }).click()
  await expect.poll(() => rotationOf(a)).toBe(0)
  await expect.poll(() => rotationOf(b)).toBe(0)
})
