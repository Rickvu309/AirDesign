import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { templateHex } from "./color-words"
import { exportFromDialog } from "./export-dialog"
import { openDeck, unfold } from "./design-panel"
import { partsOf } from "./shape-fills"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { test } from "./deck-test"

const exportName = "exported-picture.pptx"
const slidePart = "ppt/slides/slide1.xml"
const relsPart = "ppt/slides/_rels/slide1.xml.rels"
const photoKey = `${slidePart}#4`
const iconKey = `${slidePart}#5`
const alt = "A bar chart of sales by region"
const pictureXml =
  '<p:blipFill><a:blip r:embed="rId2"><a:alphaModFix amt="60000"/><a:grayscl/></a:blip><a:srcRect l="10000" r="10000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
const frameXml = '<a:off x="4267200" y="1905000"/><a:ext cx="3657600" cy="3048000"/>'
const svgBlip =
  '<a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="'

test.use({ viewport: { width: 1600, height: 1000 } })

function canvas(page: Page, key: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`)
}

function look(
  element: Locator,
): Promise<{ readonly image: string; readonly size: string; readonly filter: string; readonly opacity: string }> {
  return element.evaluate((node) => {
    const style = getComputedStyle(node.querySelector("[data-fill-image]") ?? node)
    return { image: style.backgroundImage, size: style.backgroundSize, filter: style.filter, opacity: style.opacity }
  })
}

async function designing(page: Page, element: Locator, end: string): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await element.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", new RegExp(`\\.${end}$`))
  return panel
}

function section(page: Page, panel: Locator, name: string): Locator {
  return panel.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) })
}

async function typed(input: Locator, value: string) {
  await input.fill(value)
  await input.press("Enter")
  await expect(input).toHaveValue(value)
}

test("a person crops, recolours, fades, describes and hides a picture, adds an icon, and the export keeps each @export", async ({
  page,
  decks,
}, testInfo) => {
  const { picturePanelCopy: pictureCopy } = await import("../../apps/web/src/copy/picture-panel-copy.ts")
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  await openDeck(page, "picture-png.pptx")
  const photo = canvas(page, photoKey)
  await expect.poll(async () => (await look(photo)).image).toContain("blob:")
  const plain = await look(photo)
  const panel = await designing(page, photo, "4")

  await unfold(panel, pictureCopy.crop)
  await unfold(panel, pictureCopy.section)
  const crop = section(page, panel, pictureCopy.crop)
  const framed = (await photo.boundingBox())?.width ?? 0
  await typed(crop.getByRole("textbox", { name: "Left", exact: true }), "10")
  await typed(crop.getByRole("textbox", { name: "Right", exact: true }), "10")
  await expect.poll(async () => (await look(photo)).size).not.toBe(plain.size)
  await expect.poll(async () => Math.round((((await photo.boundingBox())?.width ?? 0) / framed) * 100)).toBe(80)
  await expect(page.getByRole("button", { name: "Undo crop", exact: true })).toBeVisible()

  const recolor = section(page, panel, pictureCopy.section).getByRole("group", { name: "Recolor", exact: true })
  await recolor.getByRole("button", { name: "Grayscale", exact: true }).click()
  await expect.poll(async () => (await look(photo)).filter).toContain("grayscale(1)")
  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect.poll(async () => (await look(photo)).filter).toBe("none")
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect.poll(async () => (await look(photo)).filter).toContain("grayscale(1)")

  await typed(panel.getByRole("textbox", { name: "Opacity", exact: true }), "60")
  await expect.poll(async () => (await look(photo)).opacity).toBe("0.6")

  await unfold(panel, "Name and alt text")
  const named = section(page, panel, "Name and alt text")
  const name = named.getByRole("textbox", { name: "Name", exact: true })
  await expect(name).toHaveValue("Picture 4")
  await name.fill("Sales chart")
  await name.blur()
  await expect(photo).toHaveAttribute("aria-label", "Sales chart")
  const altText = named.getByRole("textbox", { name: "Alt text", exact: true })
  await altText.fill(alt)
  await altText.blur()
  await expect(photo).toHaveAttribute("aria-label", alt)
  await named.getByRole("button", { name: "Hide on slide", exact: true }).click()
  await expect(photo).toHaveCount(0)
  await page.getByRole("button", { name: "Undo hide", exact: true }).click()
  await expect(photo).toHaveCount(1)
  await expect(photo).toHaveAttribute("aria-label", alt)

  const subtitle = canvas(page, `${slidePart}#3`)
  const shown = await designing(page, subtitle, "3")
  await unfold(shown, "Name and alt text")
  await section(page, shown, "Name and alt text").getByRole("button", { name: "Hide on slide", exact: true }).click()
  await expect(subtitle).toHaveCount(0)

  await page.getByRole("button", { name: "Add icon", exact: true }).click()
  const tool = page.locator("[data-icon-tool]")
  await tool.getByRole("searchbox", { name: "Search icons" }).fill("rocket")
  await tool.getByRole("button", { name: "rocket", exact: true }).click()
  const icon = canvas(page, iconKey)
  await expect.poll(async () => (await look(icon)).image).toContain("data:image/svg+xml")
  const recoloured = await look(photo)

  await page.reload()
  await decks.ready()
  await expect.poll(async () => (await look(canvas(page, photoKey))).filter).toBe(recoloured.filter)
  await expect.poll(async () => (await look(canvas(page, photoKey))).size).toBe(recoloured.size)
  await expect.poll(async () => (await look(canvas(page, iconKey))).image).toContain("data:image/svg+xml")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/picture-png.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain(pictureXml)
  expect(slide).toContain(frameXml)
  expect(slide).toContain(`<p:cNvPr id="4" name="Sales chart" descr="${alt}"/>`)
  expect(slide).toContain('<p:cNvPr id="3" name="subTitle 1" hidden="1"/>')
  expect(slide).toContain(svgBlip)
  const rocket = `ppt/media/icon-rocket.c${await templateHex("picture-png.pptx", "tx1")}.tx1`
  expect(saved.get(`${rocket}.svg`)?.toString("utf8")).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  expect(saved.get(`${rocket}.png`)?.subarray(1, 4).toString("latin1")).toBe("PNG")
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed.sort()).toEqual(["[Content_Types].xml", relsPart, slidePart].sort())
  await copyFile(file, judged)

  await decks.open(file)
  await expect.poll(async () => (await look(canvas(page, photoKey))).filter).toBe(recoloured.filter)
  await expect.poll(async () => (await look(canvas(page, photoKey))).opacity).toBe("0.6")
  await expect.poll(async () => (await look(canvas(page, iconKey))).image).toContain("data:image/svg+xml")
  await expect(canvas(page, `${slidePart}#3`)).toHaveCount(0)
})
