import { join } from "node:path"
import { expect, type Locator } from "@playwright/test"
import { covers } from "./gesture"
import { test } from "./deck-test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test.use({ viewport: { width: 1600, height: 1000 } })

function line(run: Locator): Promise<string> {
  return run.evaluate((node) => getComputedStyle(node).textDecorationLine)
}

test("Ctrl+U underlines the selected text and a second press takes it off", async ({ page, decks }) => {
  covers("underline")
  await decks.open(fixture)
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
