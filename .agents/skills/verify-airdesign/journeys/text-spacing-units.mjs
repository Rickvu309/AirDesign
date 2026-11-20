import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { shortcutCopy } from "../bin/product-copy.mjs"
import { lineHeightField } from "../look/fixed-line-height.mjs"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { designCopy } = require(path.join(repo, "apps/web/src/copy/design-copy.ts"))
  const { formatCopy } = require(path.join(repo, "apps/web/src/copy/format-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const exportWord = shortcutCopy.gestures.export
  const line = await lineHeightField(kit)
  const panel = page.locator("[data-design-element]")
  const letters = panel.getByRole("textbox", { name: textCopy.letterSpacing, exact: true })
  await expect(line).toHaveValue(textCopy.auto)
  const enter = async (field, typed, shown) => {
    await field.fill(typed)
    await field.press("Enter")
    await expect(field).toHaveValue(shown)
  }
  for (const [typed, shown] of [
    ["150%", "150"],
    [textCopy.auto, textCopy.auto],
    ["120 %", "120"],
    ["24pt", "24"],
  ])
    await enter(line, typed, shown)
  await expect(panel.getByText(designCopy.points, { exact: true })).toBeVisible()
  const run = page.locator("[data-slide-paint] [data-canvas-element] [data-run]").first()
  const spacing = () => run.evaluate((node) => Number.parseFloat(getComputedStyle(node).lineHeight))
  const fixed = await spacing()
  await capture("fixed-line-height")
  await enter(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true }), "48", "48")
  await expect(line).toHaveValue("24")
  await expect.poll(spacing).toBeCloseTo(fixed, 1)
  await enter(line, "30", "30")
  await capture("fixed-line-height-larger-type")
  await letters.fill("2pt")
  await letters.press("Enter")
  await expect(letters).toHaveValue("4.1667")
  await capture("typed-units")
  const file = path.join(path.dirname(await capture("before-export")), "text-spacing-units.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('<a:lnSpc><a:spcPts val="3000"/></a:lnSpc>')
  expect(xml).toContain('spc="200"')
  note(
    `Line height reads 150%, Auto and 120 %; 24pt stays 24 pt and ${fixed} px when the type goes to 48 pt, a bare 30 is 30 pt; letter spacing 2pt is 4.1667% of 48 pt; export writes lnSpc spcPts 3000 and spc 200: ${file}`,
  )
}
