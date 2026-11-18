import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { PNG } from "pngjs"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { fixtures, openDeck, setPanelMode, settled } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

const part = "ppt/slides/slide1.xml"

function photo(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`)
}

function shaded(painted: Locator): Promise<boolean> {
  return painted.evaluate((node) =>
    [node, ...node.querySelectorAll("*")].some((each) =>
      getComputedStyle(each).backgroundImage.includes("linear-gradient("),
    ),
  )
}

function slideImage(parts: ReadonlyMap<string, Buffer>): PNG {
  const slide = parts.get(part)?.toString("utf8") ?? ""
  const embed = /<p:blipFill[^>]*>\s*<a:blip r:embed="(rId\d+)"/.exec(slide)?.[1] ?? ""
  const rels = parts.get("ppt/slides/_rels/slide1.xml.rels")?.toString("utf8") ?? ""
  const target = new RegExp(`Id="${embed}"[^>]*Target="\\.\\./media/([^"]+)"`).exec(rels)?.[1] ?? ""
  return PNG.sync.read(parts.get(`ppt/media/${target}`) ?? Buffer.alloc(0))
}

function bandLight(image: PNG, from: number, to: number): number {
  let sum = 0
  let count = 0
  for (let y = Math.floor(image.height * from); y < Math.floor(image.height * to); y += 1)
    for (let x = 0; x < image.width; x += 1) {
      const at = (y * image.width + x) * 4
      sum += ((image.data[at] ?? 0) + (image.data[at + 1] ?? 0) + (image.data[at + 2] ?? 0)) / 3
      count += 1
    }
  return sum / count
}

test("a person adds a gradient over a photo in the design-mode fills list, undoes it in one step, and the export reopens with it @export", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await photo(page).click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await setPanelMode(page, "design")
  const fill = panel
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: fillCopy.section, exact: true }) })
  const hide = (at: number, count: number) =>
    fill.getByRole("button", { name: `${fillCopy.paint(at, count)} ${fillWords.hide.toLowerCase()}`, exact: true })
  const up = fill.getByRole("button", { name: `${fillCopy.paint(0, 2)} ${fillWords.up.toLowerCase()}`, exact: true })
  await expect(hide(0, 1)).toHaveCount(0)

  await fill.getByRole("button", { name: fillCopy.add, exact: true }).click()
  await page.getByRole("menuitem", { name: `${fillCopy.add} ${fillWords.gradient.toLowerCase()}`, exact: true }).click()
  await expect.poll(() => shaded(photo(page))).toBe(true)
  await expect(up).toBeVisible()
  await expect(hide(1, 2)).toBeVisible()

  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => shaded(photo(page))).toBe(false)
  await expect(hide(1, 2)).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.redoNamed.fill, exact: true }).click()
  await expect.poll(() => shaded(photo(page))).toBe(true)

  await page.reload()
  await settled(page)
  await expect.poll(() => shaded(photo(page))).toBe(true)

  const file = testInfo.outputPath("gradient-over-photo.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const slide = parts.get(part)?.toString("utf8") ?? ""
  expect(slide).toContain("<p:pic>")
  expect(slide).not.toContain("airdesign.app/2026/fills")
  const before = slideImage(await partsOf(join(fixtures, "picture-png.pptx")))
  const baked = slideImage(parts)
  expect(bandLight(baked, 0.9, 1)).toBeLessThan(bandLight(before, 0.9, 1) / 2)
  expect(Math.abs(bandLight(baked, 0, 0.05) - bandLight(before, 0, 0.05))).toBeLessThan(25)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect(photo(page)).toBeVisible()
  await expect.poll(() => photo(page).evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("url(")
})
