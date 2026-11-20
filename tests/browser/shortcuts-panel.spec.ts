import { expect, test } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { gestures } from "../../packages/render/src/gestures.ts"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("Ctrl+Shift+? opens the keyboard shortcuts along the bottom, one tab per group of the gesture table", async ({
  page,
}) => {
  covers("shortcuts")
  await openDeck(page, "clean.pptx")
  const panel = page.getByRole("region", { name: shortcutCopy.title, exact: true })
  await expect(panel).toHaveCount(0)
  await page.keyboard.press("Control+Shift+?")
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  expect(box === null ? null : Math.round(box.y + box.height)).toBe(923)
  expect(box?.width).toBe(1470)
  const toolbar = await page.locator("[data-editor-toolbar]").boundingBox()
  expect(toolbar === null || box === null ? null : toolbar.y + toolbar.height <= box.y).toBe(true)

  for (const group of ["arrange", "present", "select"] as const) {
    await panel.getByRole("button", { name: shortcutCopy.groups[group], exact: true }).click()
    await expect(panel.getByRole("button", { name: shortcutCopy.groups[group], exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    const ids = gestures.filter((row) => row.group === group).map((row) => row.id)
    await expect(panel.locator("[data-shortcut]")).toHaveCount(ids.length)
    for (const id of ids)
      await expect(panel.locator(`[data-shortcut="${id}"]`)).toContainText(shortcutCopy.gestures[id])
  }
  await panel.getByRole("button", { name: shortcutCopy.groups.arrange, exact: true }).click()
  const { other } = shortcutCopy.chord
  const bracket = shortcutCopy.keyNames.BracketRight
  await expect(panel.locator('[data-shortcut="front"] kbd')).toHaveText([bracket, other.mod, other.shift, bracket])

  const layer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await layer.click()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await expect(panel).toBeVisible()

  await page.keyboard.press("Control+Shift+?")
  await expect(panel).toHaveCount(0)
  await page.keyboard.press("Control+Shift+?")
  await panel.getByRole("button", { name: shortcutCopy.groups.view, exact: true }).focus()
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await page.keyboard.press("Control+Shift+?")
  await panel.getByRole("button", { name: shortcutCopy.close, exact: true }).click()
  await expect(panel).toHaveCount(0)
})
