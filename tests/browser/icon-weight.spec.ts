import { join } from "node:path"
import { expect, test, type Locator } from "@playwright/test"
import { templateHex } from "./color-words"
import { decksOn } from "./deck-test"
import { designing, openDeck } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const slidePart = "ppt/slides/slide1.xml"
const relsPart = "ppt/slides/_rels/slide1.xml.rels"
const iconKey = `${slidePart}#5`

function drawnSvg(icon: Locator): Promise<string> {
  return icon.evaluate(async (node) => {
    const url = /url\("(.+)"\)/.exec(getComputedStyle(node).backgroundImage)?.[1]
    return url === undefined ? "" : (await fetch(url)).text()
  })
}

test("a person sets an icon's weight, its lines repaint, Undo puts Lucide's 2 back, and the export draws the icon at that weight @export", async ({
  page,
}) => {
  const { picturePanelCopy: pictureCopy } = await import("../../apps/web/src/copy/picture-panel-copy")
  const { pictureCopy: toolCopy } = await import("../../apps/web/src/copy/picture-copy")
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: toolCopy.addIcon, exact: true }).click()
  const tool = page.locator("[data-icon-tool]")
  await tool.getByRole("searchbox", { name: toolCopy.search }).fill("rocket")
  await tool.getByRole("button", { name: "rocket", exact: true }).click()
  const icon = page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
  await expect.poll(() => drawnSvg(icon)).toContain('stroke-width="2"')

  const panel = await designing(page, icon)
  const weight = panel.getByRole("textbox", { name: pictureCopy.weight, exact: true })
  await expect(weight).toHaveValue("2")
  await weight.fill("1.5")
  await weight.press("Enter")
  await expect(weight).toHaveValue("1.5")
  await expect.poll(() => drawnSvg(icon)).toContain('stroke-width="1.5"')

  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect(weight).toHaveValue("2")
  await expect.poll(() => drawnSvg(icon)).toContain('stroke-width="2"')
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect(weight).toHaveValue("1.5")
  await expect.poll(() => drawnSvg(icon)).toContain('stroke-width="1.5"')

  const photo = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#4"]`)
  await photo.click({ position: { x: 8, y: 8 } })
  await expect(panel).toHaveAttribute("data-design-element", /\.4$/)
  await expect(panel.getByRole("textbox", { name: pictureCopy.weight, exact: true })).toHaveCount(0)

  const file = join(process.cwd(), "tests/browser", "exported-icon-weight.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const rels = parts.get(relsPart)?.toString("utf8") ?? ""
  const thin = `icon-rocket.w150.c${await templateHex("picture-png.pptx", "tx1")}.tx1`
  expect(rels).toContain(`Target="../media/${thin}.svg"`)
  expect(rels).toContain(`Target="../media/${thin}.png"`)
  expect(parts.get(`ppt/media/${thin}.svg`)?.toString("utf8")).toContain('stroke-width="1.5"')
  expect(parts.get(`ppt/media/${thin}.png`)?.subarray(1, 4).toString("latin1")).toBe("PNG")

  await decksOn(page).open(file)
  const reopened = page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
  await expect.poll(() => drawnSvg(reopened)).toContain('stroke-width="1.5"')
  const shown = await designing(page, reopened)
  await expect(shown.getByRole("textbox", { name: pictureCopy.weight, exact: true })).toHaveValue("1.5")
})
