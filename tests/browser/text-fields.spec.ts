import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { textCopy, textWords } from "../../apps/web/src/copy/text-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck, settled } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

const slide = "ppt/slides/slide1.xml"
const canvas = (page: Page) => page.locator(`[data-slide-paint] [data-canvas-element="${slide}#2"]`)

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

for (const feature of ["strike", "letter-spacing", "numbers"] as const) {
  test(`sets ${feature} in Design, keeps it after reload and exports it @export`, async ({ page }, info) => {
    await openDeck(page, "clean.pptx")
    await page.getByRole("button", { name: "Design", exact: true }).click()
    await canvas(page).click({ position: { x: 4, y: 4 } })
    const panel = page.locator("[data-design-element]")
    if (feature === "strike") {
      await panel.getByRole("button", { name: formatCopy.named.strike, exact: true }).click()
      await expect(canvas(page).locator("[data-run]").first()).toHaveCSS("text-decoration-line", "line-through")
    } else if (feature === "letter-spacing") {
      const field = panel.getByRole("textbox", { name: textCopy.letterSpacing, exact: true })
      await field.fill("-2")
      await field.press("Enter")
      await expect(field).toHaveValue("-2")
      await expect
        .poll(() =>
          canvas(page)
            .locator("[data-run]")
            .first()
            .evaluate((run) => parseFloat(getComputedStyle(run).letterSpacing)),
        )
        .toBeLessThan(0)
    } else {
      await panel.getByRole("button", { name: textWords["list.numbers"], exact: true }).click()
      await canvas(page).dblclick()
      const editor = canvas(page).locator('[contenteditable="true"]')
      await editor.press("End")
      await editor.press("Enter")
      await page.keyboard.type("Second")
      await expect(editor.locator("[data-paragraph]")).toHaveCount(2)
      const firstSize = await editor
        .locator("[data-run]")
        .filter({ hasText: "Hello" })
        .first()
        .evaluate((run) => getComputedStyle(run).fontSize)
      await expect(
        editor.locator("[data-paragraph]").last().locator("[data-run]").filter({ hasText: "Second" }).first(),
      ).toHaveCSS("font-size", firstSize)
      expect(
        await editor
          .locator("[data-paragraph]")
          .last()
          .evaluate((paragraph) => getComputedStyle(paragraph, "::before").fontSize),
      ).toBe(firstSize)
      await expect
        .poll(() =>
          editor
            .locator("[data-paragraph]")
            .last()
            .evaluate((paragraph) => parseFloat(getComputedStyle(paragraph, "::before").marginInlineEnd)),
        )
        .toBeGreaterThan(0)
      await expect
        .poll(() =>
          editor
            .locator("[data-paragraph]")
            .last()
            .evaluate((paragraph) => getComputedStyle(paragraph, "::before").content),
        )
        .toBe('"2."')
      await editor.press("Escape")
    }
    await page.reload()
    await settled(page)
    const file = info.outputPath(`${feature}.pptx`)
    await savedExport(page, file)
    const xml = (await partsOf(file)).get(slide)?.toString("utf8") ?? ""
    if (feature === "strike") expect(xml).toContain('strike="sngStrike"')
    else if (feature === "letter-spacing") expect(xml).toContain('spc="-64"')
    else {
      expect(xml.match(/<a:buAutoNum type="arabicPeriod"\/>/g)).toHaveLength(2)
      expect(xml.match(/sz="3200"/g)).toHaveLength(2)
    }
    await copyFile(file, join(process.cwd(), "tests/browser", `exported-${feature}.pptx`))
  })
}

test("double-clicking a new rectangle opens its label editor", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const count = await layers.count()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(layers).toHaveCount(count + 1)
  const rectangle = layers.last()
  const label = rectangle.locator('[contenteditable="true"]')
  await expect(label).not.toBeFocused()
  await rectangle.dblclick()
  await expect(label).toBeFocused()
  await page.keyboard.type("Label")
  await expect(label).toHaveText("Label")
  await label.press("Escape")
  await page.reload()
  await settled(page)
  await expect(rectangle).toContainText("Label")
})

test("Justify and Type settings keep the original text through a reload", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("button", { name: designCopy.designMode, exact: true }).click()
  await canvas(page).click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("button", { name: formatCopy.align.justify, exact: true }).click()
  await expect(canvas(page).locator("[data-paragraph]").first()).toHaveCSS("text-align", "justify")
  await panel.getByRole("button", { name: textCopy.settings, exact: true }).click()
  await page.getByRole("combobox", { name: textCopy.case, exact: true }).click()
  await page.getByRole("option", { name: textWords["case.lower"], exact: true }).click()
  const run = canvas(page).locator("[data-run]").first()
  await expect(run).toHaveCSS("text-transform", "lowercase")
  await expect(run).toContainText("Hello")
  await page.reload()
  await settled(page)
  await expect(run).toHaveCSS("text-transform", "lowercase")
  await expect(run).toContainText("Hello")
})
