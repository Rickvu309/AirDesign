import path from "node:path"
import { expect } from "@playwright/test"
import { frameCopy, groupCopy, shapeCopy, shortcutCopy, transitionCopy, undoCopy } from "../bin/product-copy.mjs"

const fixture = "scripts/pptx-fixtures/clean.pptx"

async function boxOf(locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("missing box")
  return box
}

async function dragFrom(page, x, y, dx, dy) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 6 })
  await page.mouse.up()
}

export default async function drive(kit) {
  const { page, deckRoutes, repo } = kit
  const { cookie } = await kit.signIn()
  await page.goto("")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = /\/deck\/([A-Za-z0-9_-]{1,64})$/.exec(page.url())?.[1]
  if (deck === undefined) throw new Error("missing deck id")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const addShape = async (name) => {
    const before = await layers.count()
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(layers).toHaveCount(before + 1)
    const key = await layers.last().getAttribute("data-canvas-element")
    if (key === null) throw new Error("missing key")
    return page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`)
  }

  const first = await addShape(shapeCopy.shapes.square)
  const second = await addShape(shapeCopy.shapes.circle)
  const secondBox = await boxOf(second)
  await dragFrom(page, secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, 180, 70)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()

  await first.click()
  await second.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Control+Alt+KeyG")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said["plain-frame"])

  const selection = page.locator("[data-slide-paint] [data-selection]").first()
  const tight = await boxOf(selection)
  const firstBefore = await boxOf(first)
  const secondBefore = await boxOf(second)

  const corner = await boxOf(page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]'))
  await dragFrom(page, corner.x + corner.width / 2, corner.y + corner.height / 2, 150, 100)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()
  const enlarged = await boxOf(selection)
  expect(enlarged.width).toBeGreaterThan(tight.width + 80)
  await kit.capture("frame-oversized")

  await page.keyboard.press("Control+Alt+Shift+KeyR")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["resize-to-fit"], exact: true })).toBeEnabled()
  await expect.poll(async () => Math.abs((await boxOf(selection)).width - tight.width)).toBeLessThanOrEqual(2)
  await kit.capture("frame-resized-to-fit")

  const firstAfter = await boxOf(first)
  const secondAfter = await boxOf(second)
  expect(Math.abs(firstAfter.x - firstBefore.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(firstAfter.y - firstBefore.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(secondAfter.x - secondBefore.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(secondAfter.y - secondBefore.y)).toBeLessThanOrEqual(2)

  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByRole("button", { name: frameCopy.resizeToFit, exact: true })).toBeVisible()

  await expect
    .poll(async () => {
      const opened = await kit.post(deckRoutes.open, { deck }, cookie)
      const register = opened.json?.register
      const groups = (register?.order ?? []).filter((each) => each.slide === "element-group")
      const frameNode = groups.at(-1)?.element?.node
      if (frameNode === undefined) return null
      const landed = register?.elements?.[frameNode]?.landed ?? []
      return landed.length >= 2 ? { frameNode, landed: landed.length } : null
    })
    .not.toBeNull()

  kit.note("plain frame resized tightly around children via Ctrl+Alt+Shift+R and synced to server")
}
