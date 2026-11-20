import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { covers } from "./gesture"
import { test } from "./deck-test"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

function frame(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

function said(page: Page): Locator {
  return page.locator("[data-slide-paint]").getByRole("status")
}

async function order(page: Page): Promise<string[]> {
  const shapes = await page
    .locator("[data-slide-paint] [data-canvas-element]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-canvas-element")?.split("#")[1] ?? ""))
  return shapes.filter((shape) => shape === "4" || shape === "5")
}

test("the stack keys move a shape one place or to an end, and Ctrl+G groups the selected shapes", async ({
  page,
  decks,
}) => {
  covers("forward", "front", "back", "group")
  await decks.open(blank)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  await expect(frame(page, 5)).toHaveCount(1)
  await expect.poll(() => order(page)).toEqual(["4", "5"])
  await frame(page, 4).click()
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect(said(page)).toHaveText("Brought forward")
  await expect.poll(() => order(page)).toEqual(["5", "4"])
  await page.keyboard.press("ControlOrMeta+Shift+BracketLeft")
  await expect(said(page)).toHaveText("Sent to back")
  await expect.poll(() => order(page)).toEqual(["4", "5"])
  await page.keyboard.press("ControlOrMeta+Shift+BracketRight")
  await expect(said(page)).toHaveText("Brought to front")
  await expect.poll(() => order(page)).toEqual(["5", "4"])
  await frame(page, 5).click({ modifiers: ["Shift"] })
  await page.keyboard.press("ControlOrMeta+g")
  await expect(said(page)).toHaveText("Grouped")
  await expect(page.getByRole("button", { name: "Undo group", exact: true })).toBeEnabled()
})
