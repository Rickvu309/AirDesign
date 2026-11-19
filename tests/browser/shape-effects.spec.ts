import { effectsCopy, effectsWords } from "../../apps/web/src/copy/effects-copy"
import { actualSize } from "./paint-scale"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { colorWords } from "./color-words"
import { openDeck, pickColor, settled, shownColor, unfold } from "./design-panel"
import { partsOf, shapeAt } from "./shape-fills"

const deck = "corpus/nasa-cots-electronics.pptx"
const exportName = "exported-shape-effects.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const glowing = "ppt/slides/slide7.xml"
const softened = "ppt/slides/slide8.xml"
const styleShadow =
  '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>'
const cast = '<a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr>'
const glowList = `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:effectLst><a:blur rad="63500" grow="1"/><a:glow rad="63500"><a:schemeClr val="accent2"><a:alpha val="40000"/></a:schemeClr></a:glow><a:innerShdw blurRad="50800" dist="38100" dir="2700000">${cast}</a:innerShdw>${styleShadow}</a:effectLst></p:spPr><p:style>`
const softList =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:effectLst><a:outerShdw blurRad="40000" dist="76200" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw><a:softEdge rad="63500"/></a:effectLst></p:spPr><p:style>'

test.use({ viewport: { width: 1600, height: 1000 } })

type Painted = { readonly shadow: number; readonly glow: number; readonly inner: number; readonly blur: number }

function painted(shape: Locator): Promise<Painted> {
  return shape.evaluate((node) => ({
    shadow: node.querySelectorAll("[data-effect-shadow]").length,
    glow: node.querySelectorAll("[data-effect-glow]").length,
    inner: node.querySelectorAll("[data-effect-inner]").length,
    blur: node.querySelectorAll("[data-effect-blur]").length,
  }))
}

function offset(shape: Locator): Promise<string | null> {
  return shape.evaluate((node) => node.querySelector("[data-effect-shadow]")?.getAttribute("transform") ?? null)
}

function pressed(section: Locator, label: string): Locator {
  return choices(section, label).locator('[aria-pressed="true"]')
}

async function slide(page: Page, position: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${position}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

function effectsSection(page: Page): Locator {
  const panel = page.locator("[data-design-element]")
  return panel.locator("section").filter({ has: page.getByRole("heading", { name: "Effects", exact: true }) })
}

async function pick(page: Page, shape: Locator): Promise<Locator> {
  const button = page.getByRole("button", { name: "Design", exact: true })
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click()
  await shape.click({ position: { x: 4, y: 4 } })
  await unfold(page.locator("[data-design-element]"), "Effects")
  await expect(effectsSection(page)).toBeVisible()
  return effectsSection(page)
}

function choices(section: Locator, label: string): Locator {
  return section.getByRole("group", { name: label, exact: true }).first()
}

test("a person adds glow to a shape whose shadow comes from its style and recolours it, moves another's shadow and softens its edge, and the effects survive Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, deck)
  const names = await colorWords(deck, { slide: 6 })
  await actualSize(page)
  await slide(page, 7)
  const first = shapeAt(page, "4", glowing)
  await expect.poll(() => painted(first)).toEqual({ shadow: 1, glow: 0, inner: 0, blur: 0 })
  const effects = await pick(page, first)
  await expect(choices(effects, "Shadow").getByRole("button")).toHaveText(["None", "Outer"])
  await expect(pressed(effects, "Shadow")).toHaveText("Outer")
  await expect(choices(effects, "Glow")).toHaveCount(0)
  await expect(choices(effects, "Soft edge")).toHaveCount(0)
  await effects.getByRole("button", { name: effectsCopy.add, exact: true }).click()
  await page.getByRole("menuitem", { name: "Add glow", exact: true }).click()
  await expect.poll(() => painted(first)).toEqual({ shadow: 1, glow: 1, inner: 0, blur: 0 })
  await expect(effects.getByRole("textbox", { name: "Radius", exact: true })).toHaveValue("5")
  const glowColor = effects.getByRole("group", { name: "Color", exact: true }).first()
  await expect(shownColor(glowColor)).toHaveText(names.accent1)
  await pickColor(page, glowColor, names.accent2)
  await expect(shownColor(glowColor)).toHaveText(names.accent2)
  await effects.getByRole("button", { name: effectsCopy.add, exact: true }).click()
  await page
    .getByRole("menuitem", { name: `${effectsCopy.add} ${effectsWords["add.innerShadow"].toLowerCase()}`, exact: true })
    .click()
  await effects.getByRole("button", { name: effectsCopy.add, exact: true }).click()
  await page
    .getByRole("menuitem", { name: `${effectsCopy.add} ${effectsWords["add.blur"].toLowerCase()}`, exact: true })
    .click()
  await expect(pressed(effects, effectsCopy.innerShadow)).toHaveText(effectsWords.inner)
  await expect(pressed(effects, effectsCopy.blur)).toHaveText(effectsWords.radius)
  await expect.poll(() => painted(first)).toEqual({ shadow: 1, glow: 1, inner: 1, blur: 1 })

  await slide(page, 8)
  const second = shapeAt(page, "4", softened)
  const near = await offset(second)
  const panel = await pick(page, second)
  const distance = panel.getByRole("textbox", { name: "Distance", exact: true })
  await expect(distance).toHaveValue("1.8")
  await distance.fill("6")
  await distance.press("Enter")
  await expect.poll(() => offset(second)).not.toBe(near)
  const far = await offset(second)
  await panel.getByRole("button", { name: effectsCopy.add, exact: true }).click()
  await page.getByRole("menuitem", { name: "Add soft edge", exact: true }).click()
  await expect(pressed(panel, "Soft edge")).toHaveText("Radius")
  await expect(panel.getByRole("textbox", { name: "Radius", exact: true })).toHaveValue("5")
  await expect(second.locator("[data-effect-soft]")).toHaveCount(1)
  await page.getByRole("button", { name: "Undo effects", exact: true }).click()
  await expect(choices(panel, "Soft edge")).toHaveCount(0)
  await expect(second.locator("[data-effect-soft]")).toHaveCount(0)
  await page.getByRole("button", { name: "Undo effects", exact: true }).click()
  await expect.poll(() => offset(second)).toBe(near)
  await page.getByRole("button", { name: "Redo effects", exact: true }).click()
  await page.getByRole("button", { name: "Redo effects", exact: true }).click()
  await expect(pressed(panel, "Soft edge")).toHaveText("Radius")
  await expect.poll(() => offset(second)).toBe(far)

  await page.reload()
  await settled(page)
  await actualSize(page)
  await slide(page, 8)
  await expect.poll(() => offset(shapeAt(page, "4", softened))).toBe(far)
  await expect(shapeAt(page, "4", softened).locator("[data-effect-soft]")).toHaveCount(1)
  await expect(pressed(await pick(page, shapeAt(page, "4", softened)), "Soft edge")).toHaveText("Radius")
  await slide(page, 7)
  await expect.poll(() => painted(shapeAt(page, "4", glowing))).toEqual({ shadow: 1, glow: 1, inner: 1, blur: 1 })

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures", deck))
  const saved = await partsOf(file)
  expect(saved.get(glowing)?.toString("utf8")).toContain(glowList)
  expect(saved.get(softened)?.toString("utf8")).toContain(softList)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([glowing, softened])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await actualSize(page)
  await slide(page, 7)
  await expect.poll(() => painted(shapeAt(page, "4", glowing))).toEqual({ shadow: 1, glow: 1, inner: 1, blur: 1 })
  await slide(page, 8)
  await expect.poll(() => offset(shapeAt(page, "4", softened))).toBe(far)
  await expect(shapeAt(page, "4", softened).locator("[data-effect-soft]")).toHaveCount(1)
})
