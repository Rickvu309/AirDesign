import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { covers } from "./gesture"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function line(run: Locator): Promise<string> {
  return run.evaluate((node) => getComputedStyle(node).textDecorationLine)
}

test("Ctrl+U underlines the selected text and a second press takes it off", async ({ page }) => {
  covers("underline")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+u")
  const run = editor.locator("[data-run]").first()
  await expect.poll(() => line(run)).toBe("underline")
  await expect(
    page.getByRole("group", { name: "Text format" }).getByRole("button", { name: "Underline" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("ControlOrMeta+u")
  await expect.poll(() => line(run)).toBe("none")
})
