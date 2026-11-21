import { expect, type Locator } from "@playwright/test"
import { test } from "./deck-test"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

function style(node: Locator, name: "textDecorationLine" | "fontSize" | "textAlign"): Promise<string> {
  return node.evaluate((each, key) => getComputedStyle(each)[key], name)
}

test("Figma's text keys strike, resize, align and bullet the selected text layer", async ({ page }) => {
  covers("strike", "size-up", "size-down", "text-left", "text-center", "text-right", "text-justify", "bullets")
  await openDeck(page, "clean.pptx")
  const layer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await layer.click()
  const run = layer.locator("[data-run]").first()
  const paragraph = layer.locator("[data-paragraph]").first()

  await page.keyboard.press("ControlOrMeta+Shift+KeyX")
  await expect.poll(() => style(run, "textDecorationLine")).toContain("line-through")
  await page.keyboard.press("ControlOrMeta+Shift+KeyX")
  await expect.poll(() => style(run, "textDecorationLine")).not.toContain("line-through")

  const before = Number.parseFloat(await style(run, "fontSize"))
  await page.keyboard.press("ControlOrMeta+Shift+Period")
  await expect.poll(async () => Number.parseFloat(await style(run, "fontSize"))).toBeGreaterThan(before)
  await page.keyboard.press("ControlOrMeta+Shift+Comma")
  await expect.poll(async () => Number.parseFloat(await style(run, "fontSize"))).toBeCloseTo(before, 1)

  for (const [key, align] of [
    ["ControlOrMeta+Alt+KeyT", "center"],
    ["ControlOrMeta+Alt+KeyR", "right"],
    ["ControlOrMeta+Alt+KeyJ", "justify"],
    ["ControlOrMeta+Alt+KeyL", "left"],
  ] as const) {
    await page.keyboard.press(key)
    await expect.poll(() => style(paragraph, "textAlign")).toBe(align)
  }

  const bullets = page.locator("[data-editor-toolbar]").getByRole("button", { name: formatCopy.bullets })
  await expect(bullets).toHaveAttribute("aria-pressed", "false")
  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  await expect(bullets).toHaveAttribute("aria-pressed", "true")
})

test("Tab and Ctrl+] indent a list item while typing, and Shift+Tab and Ctrl+[ outdent it, as Figma's do", async ({
  page,
}) => {
  covers("list-indent", "list-outdent")
  await openDeck(page, "clean.pptx")
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Two")
  await text.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  await text.press("ControlOrMeta+End")
  const second = text.locator("[data-paragraph]").nth(1)
  const indent = () => second.evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingLeft))
  const first = await indent()
  await page.keyboard.press("Tab")
  await expect(second).toHaveAttribute("data-level", "1")
  await expect.poll(indent).toBeGreaterThan(first)
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect(second).toHaveAttribute("data-level", "2")
  await page.keyboard.press("Shift+Tab")
  await expect(second).toHaveAttribute("data-level", "1")
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect(second).not.toHaveAttribute("data-level", /./)
  await expect.poll(indent).toBeCloseTo(first, 1)
  await expect(text).toBeFocused()
})
