import { colorNameCopy } from "../../apps/web/src/copy/color-name-copy"
import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { templateStyleCopy } from "../../apps/web/src/copy/template-style-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { colorWords } from "./color-words"
import { openDeck, settled, typeColor } from "./design-panel"
import { boxFillPanel, filled, partsOf } from "./shape-fills"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

const exportName = "exported-theme.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const themes = ["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"]
const red = "c00000"

test.use({ viewport: { width: 1600, height: 1000 } })

async function themePanel(page: Page, index?: number): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  if (index === undefined) await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  else {
    await page.locator("[data-template-style]").click()
    await page
      .getByRole("button", { name: designCopy.editTemplateStyle, exact: true })
      .nth(index + 1)
      .click()
  }
  const theme = page.locator("[data-template-style-dialog]")
  await expect(theme).toBeVisible()
  return theme
}

function entry(page: Page, number: number): Locator {
  return page.locator(`[data-slide-entry="${String(number)}"]`)
}

function painted(page: Page, element: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${element}"]`)
}

function fonts(element: Locator): Promise<string> {
  return element.evaluate((node) =>
    [...node.querySelectorAll<HTMLElement>("*")].map((each) => each.style.fontFamily).join(" | "),
  )
}

test("a person changes accent 1 and the heading font of a deck with two themes, every slide that names them repaints, and the theme survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await rm(judged, { force: true })
  const source = "doe-heat-pumps.pptx"
  const accent = await colorWords(source, { theme: 0 })
  const accentRed = await colorWords(source, { theme: 0, slots: { accent1: red } })
  await openDeck(page, source)
  await entry(page, 8).click()
  let theme = await themePanel(page)
  const oval = painted(page, "ppt/slides/slide8.xml#7")
  await expect(oval).toBeVisible()
  const ovalBefore = await oval.innerHTML()
  await typeColor(page, theme.getByRole("button", { name: accent.accent1, exact: true }), colorCopy.hexName(red))
  await expect.poll(() => oval.innerHTML()).not.toBe(ovalBefore)
  await expect(theme.getByRole("button", { name: accentRed.accent1, exact: true })).toHaveAttribute(
    "title",
    new RegExp(colorCopy.hexName(red), "i"),
  )

  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  theme = await themePanel(page, 0)
  await typeColor(page, theme.getByRole("button", { name: accent.accent1, exact: true }), colorCopy.hexName(red))
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await entry(page, 1).click()
  theme = await themePanel(page, 0)
  const title = painted(page, "ppt/slides/slide1.xml#2")
  await expect.poll(() => fonts(title)).toContain("Calibri Light")
  const heading = theme.getByRole("textbox", { name: templateStyleCopy.major, exact: true })
  await expect(heading).toHaveValue("Calibri Light")
  await heading.fill("Georgia")
  await heading.press("Enter")
  await expect.poll(() => fonts(title)).toContain("Georgia")
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed["template-font"], exact: true }).click()
  await expect.poll(() => fonts(title)).not.toContain("Georgia")
  theme = await themePanel(page)
  await expect(heading).toHaveValue("Calibri Light")
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.redoNamed["template-font"], exact: true }).click()
  await expect.poll(() => fonts(title)).toContain("Georgia")

  await page.reload()
  await settled(page)
  theme = await themePanel(page)
  await expect(theme.getByRole("textbox", { name: templateStyleCopy.major, exact: true })).toHaveValue("Georgia")
  await expect(theme.getByRole("button", { name: accentRed.accent1, exact: true })).toHaveAttribute(
    "title",
    new RegExp(colorCopy.hexName(red), "i"),
  )
  await expect.poll(() => fonts(painted(page, "ppt/slides/slide1.xml#2"))).toContain("Georgia")

  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  theme = await themePanel(page, 1)
  await theme.getByRole("textbox", { name: templateStyleCopy.major, exact: true }).fill("Georgia")
  await theme.getByRole("textbox", { name: templateStyleCopy.major, exact: true }).press("Enter")
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  const saved = await partsOf(file)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name).sort()).toEqual(themes)
  for (const part of themes) {
    const xml = saved.get(part)?.toString("utf8") ?? ""
    expect(xml).toContain('<a:accent1><a:srgbClr val="C00000"/></a:accent1>')
    const latin = /<a:majorFont>(<a:latin[^>]*>)/.exec(original.get(part)?.toString("utf8") ?? "")?.[1]
    expect(latin).toBeDefined()
    expect(xml).toContain(latin?.replace(/typeface="[^"]*"/, 'typeface="Georgia"') ?? "missing Latin font")
  }
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  theme = await themePanel(page)
  await expect(theme.getByRole("textbox", { name: templateStyleCopy.major, exact: true })).toHaveValue("Georgia")
  await expect(theme.getByRole("button", { name: accentRed.accent1, exact: true })).toHaveAttribute(
    "title",
    new RegExp(colorCopy.hexName(red), "i"),
  )
})

test("a shape filled with accent 1 shows the theme's new accent 1 in its fill swatch, as the canvas paints it", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const accent = await colorWords("clean.pptx")
  const theme = await themePanel(page)
  await typeColor(page, theme.getByRole("button", { name: accent.accent1, exact: true }), colorCopy.hexName(red))
  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  const shape = painted(page, "ppt/slides/slide1.xml#2")
  const fill = await boxFillPanel(page, shape)
  const swatch = fill.locator("[data-control='color'] span[aria-hidden]").first()
  await expect(swatch).toHaveCSS("background-color", "rgb(192, 0, 0)")
  await expect.poll(() => filled(shape)).toBe("rgb(192, 0, 0)")
})

test("names the pale teal template accent in Selection colors", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(page.locator("[data-selection-colors]")).toContainText(colorNameCopy.lightTeal)
})
