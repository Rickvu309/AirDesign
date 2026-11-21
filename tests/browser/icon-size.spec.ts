import { join } from "node:path"
import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { openDeck } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

const slidePart = "ppt/slides/slide1.xml"
const slideWidth = 12_192_000

test("Add icon makes the icon 1.5 times the slide's body text, 36 pt beside a 44 pt title and 24 pt subtitle", async ({
  page,
}) => {
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy")
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: pictureCopy.addIcon, exact: true }).click()
  const tool = page.locator("[data-icon-tool]")
  await tool.getByRole("searchbox", { name: pictureCopy.search }).fill("rocket")
  await tool.getByRole("button", { name: "rocket", exact: true }).click()
  const icon = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#5"]`)
  await expect(icon).toBeVisible()
  const side = 36 * 12_700
  const shown = async () => {
    const [drawn, slide] = await Promise.all([icon.boundingBox(), page.locator("[data-slide-paint]").boundingBox()])
    return Math.round(((drawn?.width ?? 0) / (slide?.width ?? 1)) * 10_000)
  }
  await expect.poll(shown).toBe(Math.round((side / slideWidth) * 10_000))

  const file = join(process.cwd(), "tests/browser", "exported-icon-size.pptx")
  await savedExport(page, file)
  const xml = (await partsOf(file)).get(slidePart)?.toString("utf8") ?? ""
  expect(xml).toMatch(new RegExp(`<p:cNvPr id="5"[^>]*/>[\\s\\S]*?<a:ext cx="${String(side)}" cy="${String(side)}"/>`))
})
