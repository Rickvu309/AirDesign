import { exportCopy } from "../../apps/web/src/export/export-options"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { openDeck, settled } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf } from "./shape-fills"

const exported = "exported-template-style.pptx"

test("applies a template to one slide, keeps the other slides and placeholders, and survives undo, reload and export @export", async ({
  page,
}, info) => {
  await rm(join(process.cwd(), "tests/browser", exported), { force: true })
  await openDeck(page, "doe-heat-pumps.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const card = page.locator("[data-design-panel] [data-template-style]")
  await card.click()
  const popup = page.locator('[data-slot="popover-content"]')
  await expect(popup.locator("[data-template-style]")).toHaveCount(2)
  await popup.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).nth(1).click()
  const dialog = page.locator("[data-design-theme]")
  await dialog.getByRole("button", { name: designCopy.templateMore, exact: true }).click()
  await dialog.getByRole("textbox", { name: designCopy.renameTemplate, exact: true }).fill("Dark slides")
  await dialog.getByRole("textbox", { name: designCopy.renameTemplate, exact: true }).press("Enter")
  await expect(dialog.getByRole("heading", { name: "Dark slides", exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()
  await card.click()
  await popup.locator("[data-template-style]").nth(1).click()
  await expect(card).toContainText("Dark slides")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.template, exact: true })).toBeVisible()
  await page.getByRole("button", { name: undoCopy.undoNamed.template, exact: true }).click()
  await expect(card).not.toContainText("Dark slides")
  await page.getByRole("button", { name: undoCopy.redoNamed.template, exact: true }).click()
  await expect(card).toContainText("Dark slides")
  await page.reload()
  await settled(page)
  await expect(card).toContainText("Dark slides")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = info.outputPath(exported)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  const saved = await partsOf(file)
  const allowed = new Set([
    "[Content_Types].xml",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/slides/_rels/slide1.xml.rels",
    "ppt/theme/theme2.xml",
  ])
  for (const [part, bytes] of original) if (!allowed.has(part)) expect(saved.get(part)?.equals(bytes), part).toBe(true)
  expect(saved.get("ppt/slides/_rels/slide1.xml.rels")?.equals(original.get("ppt/slides/_rels/slide1.xml.rels")!)).toBe(
    false,
  )
  expect([...saved.keys()].filter((part) => !original.has(part))).toHaveLength(4)
  await copyFile(file, join(process.cwd(), "tests/browser", exported))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(page.getByRole("button", { name: designCopy.chooseTemplateStyle, exact: true })).toBeVisible()
})

test("one Undo restores the template assignment of two selected grid slides", async ({ page }, info) => {
  await openDeck(page, "doe-heat-pumps.pptx")
  await page.getByRole("button", { name: "Grid", exact: true }).click()
  await page.locator('[data-slide-entry="1"]').click({ position: { x: 1, y: 1 } })
  await page.locator('[data-slide-entry="2"]').click({ position: { x: 1, y: 1 }, modifiers: ["Shift"] })
  const { slideListCopy } = await import("../../apps/web/src/copy/slide-list-copy")
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(2))
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator("[data-design-panel] [data-template-style]").click()
  await page.locator('[data-slot="popover-content"] [data-template-style]').first().click()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: exportCopy.action, exact: true }).click()
  await page.getByRole("combobox", { name: exportCopy.slides }).click()
  await page.getByRole("option", { name: exportCopy.allSlides, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.action, exact: true })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  const file = info.outputPath("selected.pptx")
  await (await download).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  const saved = await partsOf(file)
  expect(saved.get("ppt/slides/_rels/slide2.xml.rels")?.equals(original.get("ppt/slides/_rels/slide2.xml.rels")!)).toBe(
    false,
  )
  for (const [part, bytes] of original) {
    if (/^ppt\/slides\//.test(part) && part !== "ppt/slides/_rels/slide2.xml.rels")
      expect(saved.get(part)?.equals(bytes), part).toBe(true)
  }
  await page.getByRole("button", { name: undoCopy.undoNamed.template, exact: true }).click()
  const restored = page.waitForEvent("download")
  await page.getByRole("button", { name: exportCopy.action, exact: true }).click()
  await page.getByRole("combobox", { name: exportCopy.slides }).click()
  await page.getByRole("option", { name: exportCopy.allSlides, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.action, exact: true })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  const undoFile = info.outputPath("undone.pptx")
  await (await restored).saveAs(undoFile)
  const undone = await partsOf(undoFile)
  expect([...undone.keys()]).toEqual([...original.keys()])
  for (const [part, bytes] of original) expect(undone.get(part)?.equals(bytes), part).toBe(true)
})
