import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { exportFromDialog } from "./export-dialog"
import { boxFillPanel, fillPanel, filled, partsOf, shapeAt } from "./shape-fills"
import { colorWords } from "./color-words"
import { openDeck, openFillDetails, pickColor, settled, setPanelMode, shownColor } from "./design-panel"
import { fillWords } from "../../apps/web/src/copy/fill-copy.ts"

const exportName = "exported-shape-fill.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide1.xml"
const copyPart = "ppt/slides/slide2.xml"
const deckParts = ["[Content_Types].xml", "ppt/_rels/presentation.xml.rels", "ppt/presentation.xml"]
const accentTwoXml = '<a:solidFill><a:schemeClr val="accent2"><a:alpha val="100000"/></a:schemeClr></a:solidFill>'
const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${String(number)}"]`)
}

test("a person fills a shape whose fill comes from its style with a color and another with a gradient, and the fills survive Undo, a reload, a duplicate, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "shapes-added.pptx")
  const names = await colorWords("shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const oval = shapeAt(page, "5")
  const accentOne = await filled(rectangle)
  const panel = await fillPanel(page, rectangle)
  const kinds = panel.getByRole("group", { name: "Fill", exact: true })
  await setPanelMode(page, "slides")
  await expect(kinds.getByRole("button")).toHaveText(["None", fillWords.solid, "Gradient", "Icon"])
  await expect(kinds.getByRole("button", { name: fillWords.solid, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(panel.getByRole("button", { name: fillCopy.reset, exact: true })).toHaveCount(0)
  const colors = panel.getByRole("group", { name: "Color", exact: true })
  await expect(shownColor(colors)).toHaveText(names.accent1)
  await pickColor(page, colors, names.accent2)
  await expect.poll(() => filled(rectangle)).not.toBe(accentOne)
  const accentTwo = await filled(rectangle)
  await expect(shownColor(colors)).toHaveText(names.accent2)
  await openFillDetails(panel)
  await expect(panel.getByRole("button", { name: fillCopy.reset, exact: true })).toBeVisible()

  const ovalPanel = await fillPanel(page, oval)
  await ovalPanel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Gradient" }).click()
  await expect.poll(() => filled(oval)).toContain("gradient")
  await expect(
    ovalPanel.getByRole("group", { name: "Direction", exact: true }).getByRole("button", { name: "Linear" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect.poll(() => filled(oval)).toBe(accentOne)
  await page.getByRole("button", { name: "Redo fill", exact: true }).click()
  await expect.poll(() => filled(oval)).toContain("gradient")
  const gradient = await filled(oval)

  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(accentTwo)
  await expect.poll(() => filled(shapeAt(page, "5"))).toBe(gradient)

  await page.keyboard.press("Escape")
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect.poll(() => filled(page.locator('[data-slide-paint] [data-canvas-element$="#4"]'))).toBe(accentTwo)
  await expect.poll(() => filled(page.locator('[data-slide-paint] [data-canvas-element$="#5"]'))).toBe(gradient)
  await entry(page, 1).click()
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx"))
  const saved = await partsOf(file)
  for (const part of [slidePart, copyPart]) {
    const slide = saved.get(part)?.toString("utf8") ?? ""
    expect(slide).toContain(`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${accentTwoXml}</p:spPr>`)
    expect(slide).toMatch(/<a:prstGeom prst="ellipse"><a:avLst\/><\/a:prstGeom><a:gradFill rotWithShape="0"><a:gsLst>/)
  }
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name).sort()).toEqual([...deckParts, slidePart].sort())
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "4"))).toBe(accentTwo)
  await expect.poll(() => filled(shapeAt(page, "5"))).toBe(gradient)
})

test("a person resets a shape's own fill to the one its style gives, and Undo brings the own fill back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const own = await filled(shape)
  const panel = await boxFillPanel(page, shape)
  await panel.getByRole("button", { name: fillCopy.reset, exact: true }).click()
  await expect.poll(() => filled(shape)).not.toBe(own)
  await expect(panel.getByRole("button", { name: fillCopy.reset, exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect.poll(() => filled(shape)).toBe(own)
  await expect(panel.getByRole("button", { name: fillCopy.reset, exact: true })).toBeVisible()
})
