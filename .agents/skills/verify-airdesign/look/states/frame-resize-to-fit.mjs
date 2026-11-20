import { expect } from "@playwright/test"
import { frameCopy, groupCopy, shapeCopy, shortcutCopy, transitionCopy, undoCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

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

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const addShape = async (name) => {
    const before = await layers.count()
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
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

  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
}

export default { name: "frame-resize-to-fit", design: "/screens/s43-09-editor-tools-design-element", drive }
