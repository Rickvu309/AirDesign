import { join } from "node:path"
import { expect, test, type Locator } from "@playwright/test"
import { colorWords, templateHex } from "./color-words"
import { decksOn } from "./deck-test"
import { designing, openDeck, pickColor, shownColor } from "./design-panel"
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

test("a new icon takes the template's text color, a person colors it Accent 1, Undo puts the text color back, and the export draws the icon in that color @export", async ({
  page,
}) => {
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy")
  const names = await colorWords("picture-png.pptx")
  const text = await templateHex("picture-png.pptx", "tx1")
  const accent = await templateHex("picture-png.pptx", "accent1")
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: pictureCopy.addIcon, exact: true }).click()
  const tool = page.locator("[data-icon-tool]")
  await tool.getByRole("searchbox", { name: pictureCopy.search }).fill("rocket")
  await tool.getByRole("button", { name: "rocket", exact: true }).click()
  const icon = page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
  await expect.poll(() => drawnSvg(icon)).toContain(`stroke="#${text}"`)

  const panel = await designing(page, icon)
  const field = panel.locator('[data-control="color"]')
  await expect(shownColor(field)).toHaveText(names.dk1 ?? "")
  await pickColor(page, field, names.accent1 ?? "")
  await expect.poll(() => drawnSvg(icon)).toContain(`stroke="#${accent}"`)

  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect(shownColor(field)).toHaveText(names.dk1 ?? "")
  await expect.poll(() => drawnSvg(icon)).toContain(`stroke="#${text}"`)
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect(shownColor(field)).toHaveText(names.accent1 ?? "")
  await expect.poll(() => drawnSvg(icon)).toContain(`stroke="#${accent}"`)

  const file = join(process.cwd(), "tests/browser", "exported-icon-color.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const svg = `ppt/media/icon-rocket.c${accent}.accent1.svg`
  expect(parts.get(relsPart)?.toString("utf8")).toContain(`Target="../media/icon-rocket.c${accent}.accent1.svg"`)
  expect(parts.get(svg)?.toString("utf8")).toContain(`stroke="#${accent}"`)
  expect(
    parts
      .get(svg.replace(/\.svg$/, ".png"))
      ?.subarray(1, 4)
      .toString("latin1"),
  ).toBe("PNG")

  await decksOn(page).open(file)
  const reopened = page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
  await expect.poll(() => drawnSvg(reopened)).toContain(`stroke="#${accent}"`)
  const shown = await designing(page, reopened)
  await expect(shownColor(shown.locator('[data-control="color"]'))).toHaveText(names.accent1 ?? "")
})
