import { expect, type Page } from "@playwright/test"
import { linkCopy } from "../../apps/web/src/copy/link-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"
import { decksOn } from "./deck-test"
import { designing } from "./design-panel"
import { holdDeviceStore } from "./device-store"
import { shapeAt } from "./shape-fills"

function saveStatus(page: Page) {
  return page.locator("[data-save-status]").first()
}

async function reloadAsked(page: Page): Promise<string[]> {
  const asked: string[] = []
  const ask = (dialog: import("@playwright/test").Dialog) => {
    asked.push(dialog.type())
    void dialog.dismiss()
  }
  page.on("dialog", ask)
  await page.evaluate(() => location.reload()).catch(() => undefined)
  page.off("dialog", ask)
  return asked
}

test.beforeEach(async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
})

test("a person who reloads before the device stored a Design panel change is asked first, and keeps the change", async ({
  page,
}) => {
  const deck = await decksOn(page).open()
  const panel = await designing(page, shapeAt(page, "2"))
  const field = panel.getByRole("textbox", { name: linkCopy.target })
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved")
  const release = await holdDeviceStore(page)
  await field.fill("https://example.com")
  await field.press("Enter")
  await expect(field).toHaveValue("https://example.com")
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saving")
  expect(await decksOn(page).readiness()).toBeNull()
  expect(await reloadAsked(page)).toEqual(["beforeunload"])
  await expect(field).toHaveValue("https://example.com")
  await release()
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved")
  expect(await reloadAsked(page)).toEqual([])
  expect(await decksOn(page).ready()).toBe(deck)
  await designing(page, shapeAt(page, "2"))
  await expect(field).toHaveValue("https://example.com")
})

test("a person who reloads before the device stored an inserted shape is asked first, and keeps the shape", async ({
  page,
}) => {
  const deck = await decksOn(page).open()
  const paint = page.locator("[data-slide-paint]").first()
  const layers = paint.locator("[data-canvas-element]")
  await paint.click({ position: { x: 4, y: 4 } })
  await expect(layers).toHaveCount(1)
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved")
  const release = await holdDeviceStore(page)
  await page.keyboard.press("r")
  await page.keyboard.press("Enter")
  await expect(layers).toHaveCount(2)
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saving")
  expect(await decksOn(page).readiness()).toBeNull()
  expect(await reloadAsked(page)).toEqual(["beforeunload"])
  await expect(layers).toHaveCount(2)
  await release()
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved")
  expect(await reloadAsked(page)).toEqual([])
  expect(await decksOn(page).ready()).toBe(deck)
  await expect(layers).toHaveCount(2)
})
