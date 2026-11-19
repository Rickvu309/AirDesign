import path from "node:path"
import { expect } from "@playwright/test"
import { designCopy, productCopy, undoCopy } from "../bin/product-copy.mjs"

const part = "ppt/slides/slide1.xml"

function shape(page, id) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(id)}"]`)
}

async function styleRect(locator) {
  return locator.evaluate((node) => ({
    x: Number.parseFloat(node.style.left),
    y: Number.parseFloat(node.style.top),
    width: Number.parseFloat(node.style.width),
    height: Number.parseFloat(node.style.height),
  }))
}

async function rotationOf(locator) {
  return locator.evaluate((node) => {
    const match = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(node.style.transform)
    return match === null ? 0 : Number(match[1])
  })
}

async function centerOf(locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("no box")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function landedRotation(register, node) {
  const rows = register?.elements?.[node]?.landed ?? []
  const last = rows.filter((row) => row.visible && row.patch?.box?.rot?.set !== undefined).at(-1)
  return last?.patch?.box?.rot?.set ?? null
}

function landedFlip(register, node, field) {
  const rows = register?.elements?.[node]?.landed ?? []
  const last = rows.filter((row) => row.visible && row.patch?.box?.[field]?.set !== undefined).at(-1)
  return last?.patch?.box?.[field]?.set ?? null
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await expect(page.getByRole("button", { name: productCopy.newDeck, exact: true })).toBeVisible()
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)

  const first = shape(page, 4)
  const second = shape(page, 5)
  await first.click()
  await expect(page.locator("[data-selection] [data-grip]")).toHaveCount(12)

  const beforeEdge = await styleRect(first)
  const rightGrip = await centerOf(page.locator('[data-selection] [data-grip="right"]'))
  await page.mouse.move(rightGrip.x, rightGrip.y)
  await page.mouse.down()
  await page.mouse.move(rightGrip.x + 50, rightGrip.y + 30, { steps: 6 })
  await expect(page.locator('[data-transform-hud="resize"]')).toContainText("×")
  await capture("edge-resize-held")
  await page.mouse.up()
  const afterEdge = await styleRect(first)
  expect(afterEdge.width).toBeCloseTo(beforeEdge.width + 50, 0)
  expect(afterEdge.height).toBeCloseTo(beforeEdge.height, 0)
  note("dragging the right edge widened the shape while keeping its height fixed and showing the W × H label")

  const beforeShift = await styleRect(first)
  const corner = await centerOf(page.locator('[data-selection] [data-grip="bottom-right"]'))
  await page.mouse.move(corner.x, corner.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(corner.x + 60, corner.y + 10, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const afterShift = await styleRect(first)
  expect(afterShift.width / afterShift.height).toBeCloseTo(beforeShift.width / beforeShift.height, 1)
  await capture("shift-corner-resized")
  note("Shift-dragging the bottom-right corner preserved the shape aspect ratio")

  const beforeAlt = await styleRect(first)
  const rightAgain = await centerOf(page.locator('[data-selection] [data-grip="right"]'))
  await page.mouse.move(rightAgain.x, rightAgain.y)
  await page.keyboard.down("Alt")
  await page.mouse.down()
  await page.mouse.move(rightAgain.x + 25, rightAgain.y, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Alt")
  const afterAlt = await styleRect(first)
  expect(afterAlt.width).toBeCloseTo(beforeAlt.width + 50, 0)
  expect(afterAlt.x + afterAlt.width / 2).toBeCloseTo(beforeAlt.x + beforeAlt.width / 2, 0)
  await capture("alt-center-resized")
  note("Alt-dragging the right edge grew symmetrically around the shape center")

  const center = await centerOf(first)
  const rotGrip = await centerOf(page.locator('[data-selection] [data-grip="rotate-top-right"]'))
  await page.mouse.move(rotGrip.x, rotGrip.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 110, center.y + 18, { steps: 8 })
  await expect(page.locator('[data-transform-hud="rotate"]')).toContainText(designCopy.degrees)
  await capture("rotate-free-held")
  await page.mouse.up()
  const freeRot = await rotationOf(first)
  expect(freeRot).toBeGreaterThan(0)
  note(`free rotate handle turned the shape to ${String(freeRot)}°`)

  const rotGripAgain = await centerOf(page.locator('[data-selection] [data-grip="rotate-top-right"]'))
  await page.mouse.move(rotGripAgain.x, rotGripAgain.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(center.x + 100, center.y + 100, { steps: 8 })
  await capture("rotate-shift-held")
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const snappedRot = await rotationOf(first)
  expect(snappedRot % 15).toBe(0)
  await expect
    .poll(async () => landedRotation((await post(deckRoutes.open, { deck }, cookie)).json.register, "256.4"), {
      timeout: 20_000,
    })
    .toBe(Math.round(snappedRot * 60_000) % 21_600_000)
  note(`Shift-rotate snapped to ${String(snappedRot)}° and persisted on the server`)

  await first.click()
  await second.click({ modifiers: ["Shift"] })
  const around = page.locator('[data-selection-around="2"]')
  await expect(around).toBeVisible()
  const startA = await styleRect(first)
  const startB = await styleRect(second)
  const multiCorner = await centerOf(around.locator('[data-grip="bottom-right"]'))
  await page.mouse.move(multiCorner.x, multiCorner.y)
  await page.mouse.down()
  await page.mouse.move(multiCorner.x + 70, multiCorner.y + 35, { steps: 6 })
  await capture("multi-resize-held")
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()
  expect((await styleRect(first)).width).toBeGreaterThan(startA.width + 5)
  expect((await styleRect(second)).width).toBeGreaterThan(startB.width + 5)
  await capture("multi-resized")
  note("resizing a two-layer selection scaled both layers together in one undo step")

  const aroundCenter = await centerOf(around)
  const multiRotGrip = await centerOf(around.locator('[data-grip="rotate-top-right"]'))
  const rotBeforeA = await rotationOf(first)
  const rotBeforeB = await rotationOf(second)
  await page.mouse.move(multiRotGrip.x, multiRotGrip.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(aroundCenter.x + 120, aroundCenter.y + 80, { steps: 8 })
  await capture("multi-rotate-held")
  await page.mouse.up()
  await page.keyboard.up("Shift")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.rotate, exact: true })).toBeEnabled()
  expect(await rotationOf(first)).not.toBe(rotBeforeA)
  expect(await rotationOf(second)).not.toBe(rotBeforeB)
  await page.getByRole("button", { name: undoCopy.undoNamed.rotate, exact: true }).click()
  await expect.poll(() => rotationOf(first)).toBe(rotBeforeA)
  await expect.poll(() => rotationOf(second)).toBe(rotBeforeB)
  note("rotating a two-layer selection turned both layers together and Undo restored both in one step")

  await second.click()
  const beforeAxis = await styleRect(second)
  const insideSecond = await centerOf(second)
  await page.mouse.move(insideSecond.x, insideSecond.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(insideSecond.x + 50, insideSecond.y + 15, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const afterAxis = await styleRect(second)
  expect(afterAxis.x).toBeCloseTo(beforeAxis.x + 50, 0)
  expect(afterAxis.y).toBeCloseTo(beforeAxis.y, 0)
  note("Shift-dragging locked movement to the horizontal axis")

  await page.keyboard.press("Shift+H")
  await expect.poll(async () => second.evaluate((node) => node.style.transform)).toContain("scale(-1, 1)")
  await page.keyboard.press("Shift+V")
  await expect.poll(async () => second.evaluate((node) => node.style.transform)).toContain("scale(-1, -1)")
  await expect
    .poll(
      async () => {
        const register = (await post(deckRoutes.open, { deck }, cookie)).json.register
        return [landedFlip(register, "256.5", "flipH"), landedFlip(register, "256.5", "flipV")]
      },
      { timeout: 20_000 },
    )
    .toEqual([true, true])
  await capture("flipped-hv")
  note("Shift+H and Shift+V flipped the layer horizontally and vertically and persisted flipH and flipV on the server")
}
