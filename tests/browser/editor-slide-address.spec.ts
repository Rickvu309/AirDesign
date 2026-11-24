import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { openEditor } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)

test("a reload opens at the slide in the address, and a gone slide opens slide 1", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(entries(page)).toHaveCount(3)
  await entry(page, 3).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect.poll(() => new URL(page.url()).searchParams.get("node-id")).not.toBeNull()
  const third = new URL(page.url()).searchParams.get("node-id") ?? ""
  await expect.poll(() => page.evaluate(() => window.history.length)).toBeGreaterThan(0)
  const before = await page.evaluate(() => window.history.length)
  await entry(page, 1).click()
  await entry(page, 2).click()
  await entry(page, 3).click()
  expect(await page.evaluate(() => window.history.length)).toBe(before)

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(entries(page)).toHaveCount(3)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  expect(new URL(page.url()).searchParams.get("node-id")).toBe(third)

  await page.goto(`/s/${opened.deck}?node-id=gone%3A9`)
  await page.locator("[data-editor-ready]").waitFor()
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect.poll(() => new URL(page.url()).searchParams.get("node-id")).not.toBe("gone:9")
})
